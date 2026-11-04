import { describe, expect, it } from 'vitest';
import { calculateCartTotals, checkCartOrderability } from '@repo/domain';
import { CartController, decodeCart, type CartStorage } from './cart';
const store = { id: 'a', name: '食堂', minimumOrderAmount: 1500 };
const product = { id: 'p', name: '定食', price: 800, soldout: false };
function setup(initial: string | null = null) {
  let raw = initial;
  const storage: CartStorage = {
    read: () => Promise.resolve(raw),
    write: (value) => {
      raw = value;
      return Promise.resolve();
    },
  };
  return { controller: new CartController(storage), storage };
}
describe('native persistent cart', () => {
  it('R-02/R-04 restores added items, edits quantity, computes minimum and removes the last item', async () => {
    const { controller, storage } = setup();
    await controller.restore();
    await controller.add(store, product);
    expect(checkCartOrderability(controller.getSnapshot().cart, 1500)).toEqual({
      status: 'below-minimum',
      shortfall: 700,
    });
    const reloaded = new CartController(storage);
    await reloaded.restore();
    expect(reloaded.getSnapshot().details[0]?.name).toBe('定食');
    await reloaded.setQuantity('p', 2);
    expect(calculateCartTotals(reloaded.getSnapshot().cart)).toEqual({
      status: 'ok',
      subtotal: 1600,
      deliveryFee: 300,
      total: 1900,
    });
    expect(checkCartOrderability(reloaded.getSnapshot().cart, 1500).status).toBe('orderable');
    await reloaded.setQuantity('p', 0);
    expect(reloaded.getSnapshot().store).toBeNull();
    expect(calculateCartTotals(reloaded.getSnapshot().cart)).toEqual({
      status: 'ok',
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
    });
  });
  it('R-03 does not mutate or persist a different store until explicitly confirmed', async () => {
    const { controller, storage } = setup();
    await controller.restore();
    await controller.add(store, product);
    const before = await storage.read();
    const other = { ...store, id: 'b', name: '別店舗' };
    expect(await controller.add(other, product)).toBe('confirmation-required');
    expect(await storage.read()).toBe(before); // cancelling the dialog has no mutation
    expect(controller.getSnapshot().store).toEqual(store);
    expect(await controller.add(other, product, true)).toBe('updated');
    expect(controller.getSnapshot().cart).toEqual([
      { restaurantId: 'b', productId: 'p', unitPrice: 800, quantity: 1 },
    ]);
  });
  it('R-03/R-10 rejects sold-out products and quantities outside 1–20', async () => {
    const { controller } = setup();
    await controller.restore();
    expect(await controller.add(store, { ...product, soldout: true })).toBe('sold-out');
    expect(controller.getSnapshot().cart).toEqual([]);
    await controller.add(store, product);
    await controller.setQuantity('p', 20);
    expect(await controller.add(store, product)).toBe('invalid');
    expect(await controller.setQuantity('p', 21)).toBe('invalid');
    expect(controller.getSnapshot().cart[0]?.quantity).toBe(20);
  });
  it('keeps the last persisted cart on write failure and permits retry', async () => {
    const { controller, storage } = setup();
    await controller.restore();
    await controller.add(store, product);
    const write = storage.write;
    storage.write = () => Promise.reject(Error('disk full'));
    expect(await controller.setQuantity('p', 2)).toBe('storage-error');
    expect(controller.getSnapshot().cart[0]?.quantity).toBe(1);
    expect(controller.getSnapshot().error).toBeTruthy();
    storage.write = write;
    await controller.setQuantity('p', 2);
    expect(controller.getSnapshot().cart[0]?.quantity).toBe(2);
  });
  it('blocks mutation during restore and concurrent persistence', async () => {
    let resolve!: (raw: string | null) => void;
    const controller = new CartController({
      read: () =>
        new Promise((r) => {
          resolve = r;
        }),
      write: () => Promise.resolve(),
    });
    const restoring = controller.restore();
    expect(await controller.add(store, product)).toBe('busy');
    resolve(null);
    await restoring;
    let finish!: () => void;
    const storage: CartStorage = {
      read: () => Promise.resolve(null),
      write: () =>
        new Promise((r) => {
          finish = r;
        }),
    };
    const saving = new CartController(storage);
    await saving.restore();
    const adding = saving.add(store, product);
    expect(await saving.add(store, product)).toBe('busy');
    finish();
    await adding;
    expect(saving.getSnapshot().cart[0]?.quantity).toBe(1);
  });
  it('recovers malformed data and rejects metadata inconsistent with the domain cart', async () => {
    const { controller } = setup('{broken');
    await controller.restore();
    expect(controller.getSnapshot().ready).toBe(true);
    expect(controller.getSnapshot().cart).toEqual([]);
    expect(controller.getSnapshot().error).toBeTruthy();
    await controller.add(store, product);
    const saved = controller.getSnapshot();
    for (const mutation of [
      { cart: [...saved.cart, ...saved.cart] },
      { store: { ...store, id: 'wrong' } },
      { details: [] },
      { cart: [{ ...saved.cart[0], quantity: 21 }] },
      { store: { ...store, minimumOrderAmount: -1 } },
    ])
      expect(() => decodeCart(JSON.stringify({ ...saved, ...mutation }))).toThrow();
  });
  it('does not discard a cart on storage read failure', async () => {
    const { controller, storage } = setup();
    const read = storage.read;
    storage.read = () => Promise.reject(Error('unavailable'));
    await controller.restore();
    expect(controller.getSnapshot().ready).toBe(false);
    storage.read = read;
    await controller.restore();
    expect(controller.getSnapshot().ready).toBe(true);
  });
});
