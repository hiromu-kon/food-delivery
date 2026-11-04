import { describe, expect, it } from 'vitest';
import { calculateCartTotals, checkCartOrderability } from '@repo/domain';
import { LocalCart, restoreCart, type MenuProduct } from './cart-state';

const store = {
  id: 'store-a',
  name: '食堂',
  minimumOrderAmount: 1000,
  description: '',
  address: '',
  latitude: 35,
  longitude: 139,
  deliveryRadiusMeters: 3000,
  isAcceptingOrders: true,
  photoUrl: null,
};
const product: MenuProduct = {
  id: 'rice',
  name: '定食',
  price: 600,
  soldout: false,
  photoUrl: null,
  description: '',
  sortOrder: 0,
};
function setup() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const cart = new LocalCart('user-a', () => storage);
  cart.subscribe(() => {});
  return { cart, data, storage };
}

describe('Web cart persistence and operations', () => {
  it('restores item names, quantities, store minimum, photos and totals on a new instance', () => {
    const { cart, storage } = setup();
    cart.add(store, { ...product, photoUrl: 'https://example.com/rice.jpg' });
    cart.add(store, product);
    cart.setQuantity(product.id, 3);
    const restored = new LocalCart('user-a', () => storage);
    expect(restored.getServerSnapshot().ready).toBe(false);
    restored.subscribe(() => {});
    expect(restored.getSnapshot().cart).toEqual(cart.getSnapshot().cart);
    const saved = restored.getSnapshot().cart!;
    expect(saved.items[0]).toMatchObject({ name: '定食', quantity: 3 });
    expect(calculateCartTotals(saved.items)).toEqual({
      status: 'ok',
      subtotal: 1800,
      deliveryFee: 300,
      total: 2100,
    });
    expect(checkCartOrderability(saved.items, saved.store.minimumOrderAmount).status).toBe(
      'orderable',
    );
  });
  it('does not write or replace the existing cart until an explicit store confirmation', () => {
    const { cart, data } = setup();
    cart.add(store, product);
    const before = data.get('user-a');
    const second = { ...store, id: 'store-b', name: '別の店', minimumOrderAmount: 2000 };
    expect(cart.add(second, { ...product, id: 'soup' })).toBe('confirmation-required');
    expect(data.get('user-a')).toBe(before);
    expect(cart.getSnapshot().cart?.store.id).toBe('store-a');
    expect(cart.add(second, { ...product, id: 'soup' }, true)).toBe('updated');
    expect(cart.getSnapshot().cart?.items.map((item) => item.productId)).toEqual(['soup']);
    expect(cart.getSnapshot().cart?.store).toMatchObject({
      id: 'store-b',
      minimumOrderAmount: 2000,
    });
  });
  it('rejects sold-out items even for confirmed replacement and preserves the cart', () => {
    const { cart, data } = setup();
    cart.add(store, product);
    const before = data.get('user-a');
    expect(cart.add({ ...store, id: 'store-b' }, { ...product, soldout: true }, true)).toBe(
      'unavailable',
    );
    expect(data.get('user-a')).toBe(before);
  });
  it('enforces 20, recomputes shortfall excluding delivery, and removes the last item from storage', () => {
    const { cart, data } = setup();
    cart.add(store, product);
    expect(checkCartOrderability(cart.getSnapshot().cart!.items, 1000)).toEqual({
      status: 'below-minimum',
      shortfall: 400,
    });
    cart.setQuantity(product.id, 20);
    expect(cart.add(store, product)).toBe('invalid');
    cart.setQuantity(product.id, 21);
    expect(cart.getSnapshot().cart?.items[0]?.quantity).toBe(20);
    cart.setQuantity(product.id, 0);
    expect(cart.getSnapshot().cart).toBeNull();
    expect(data.has('user-a')).toBe(false);
    expect(calculateCartTotals([])).toEqual({
      status: 'ok',
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    });
  });
  it('keeps accounts separate', () => {
    const { cart, storage } = setup();
    cart.add(store, product);
    const other = new LocalCart('user-b', () => storage);
    other.subscribe(() => {});
    expect(other.getSnapshot().cart).toBeNull();
  });
  it('survives unavailable storage and clearly reports that changes are not saved', () => {
    const cart = new LocalCart('blocked', () => {
      throw new Error('blocked');
    });
    cart.subscribe(() => {});
    expect(cart.getSnapshot().ready).toBe(true);
    expect(cart.getSnapshot().notice).toContain('復元できません');
    expect(cart.add(store, product)).toBe('updated');
    expect(cart.getSnapshot().cart?.items).toHaveLength(1);
    expect(cart.getSnapshot().notice).toContain('保存できません');
  });
  it('rejects malformed, mixed-store, duplicate, out-of-range and unsafe stored values', () => {
    const { cart, data } = setup();
    cart.add(store, product);
    const valid = cart.getSnapshot().cart!;
    const bad = [
      null,
      {},
      { ...valid, version: 2 },
      { ...valid, store: { ...valid.store, id: 'wrong' } },
      { ...valid, items: [...valid.items, ...valid.items] },
      ...[0, 21, 1.5].map((quantity) => ({ ...valid, items: [{ ...valid.items[0], quantity }] })),
      { ...valid, items: [{ ...valid.items[0], unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }] },
      { ...valid, items: [{ ...valid.items[0], restaurantId: 2 }] },
    ];
    for (const value of bad) expect(restoreCart(JSON.stringify(value))).toBeNull();
    expect(restoreCart('{')).toBeNull();
    expect(restoreCart(data.get('user-a')!)).not.toBeNull();
  });
});
