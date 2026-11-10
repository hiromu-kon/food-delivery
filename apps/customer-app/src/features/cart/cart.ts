import {
  addCartItem,
  calculateCartTotals,
  checkCartOrderability,
  setCartItemQuantity,
  type Cart,
  type CartChangeResult,
} from '@repo/domain';
import { z } from 'zod';

const itemSchema = z.object({
  restaurantId: z.string().min(1),
  productId: z.string().min(1),
  unitPrice: z.number(),
  quantity: z.number(),
});
const detailsSchema = z.object({
  productId: z.string(),
  name: z.string().min(1),
  photoUrl: z.string().optional(),
});
const savedSchema = z.object({
  version: z.literal(1),
  cart: z.array(itemSchema),
  store: z
    .object({ id: z.string().min(1), name: z.string().min(1), minimumOrderAmount: z.number() })
    .nullable(),
  details: z.array(detailsSchema),
});
export type SavedCart = Omit<z.infer<typeof savedSchema>, 'cart'> & { cart: Cart };
export type CartStore = NonNullable<SavedCart['store']>;
export type CartProduct = {
  id: string;
  name: string;
  price: number;
  soldout: boolean;
  photoUrl?: string | null;
};
export type CartStorage = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
};
const empty = (): SavedCart => ({ version: 1, cart: [], store: null, details: [] });
export type CartState = SavedCart & { ready: boolean; busy: boolean; error: string | undefined };

export function decodeCart(raw: string | null): SavedCart {
  if (raw === null) return empty();
  const saved = savedSchema.parse(JSON.parse(raw));
  if (
    calculateCartTotals(saved.cart).status === 'invalid' ||
    checkCartOrderability(saved.cart, saved.store?.minimumOrderAmount).status === 'invalid' ||
    (saved.cart.length > 0 && (!saved.store || saved.cart[0]?.restaurantId !== saved.store.id)) ||
    (saved.cart.length === 0 && saved.store !== null) ||
    saved.details.length !== saved.cart.length ||
    new Set(saved.details.map((item) => item.productId)).size !== saved.details.length ||
    saved.cart.some((item) => !saved.details.some((detail) => detail.productId === item.productId))
  )
    throw new Error('Invalid saved cart');
  return saved;
}

export class CartController {
  private state: CartState = { ...empty(), ready: false, busy: false, error: undefined };
  private listeners = new Set<() => void>();
  constructor(private storage: CartStorage) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<CartState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  restore = async () => {
    if (this.state.busy || this.state.ready) return;
    this.publish({ busy: true, error: undefined });
    try {
      const raw = await this.storage.read();
      let saved: SavedCart;
      try {
        saved = decodeCart(raw);
      } catch {
        saved = empty();
        await this.storage.write(JSON.stringify(saved));
        this.publish({ error: '保存されたカートを読み取れなかったため、空に戻しました。' });
      }
      this.publish({ ...saved, ready: true });
    } catch {
      this.publish({ error: 'カートを読み込めません。再試行してください。' });
    } finally {
      this.publish({ busy: false });
    }
  };
  private async commit(
    result: CartChangeResult,
    store: CartStore | null,
    details: SavedCart['details'],
  ) {
    if (result.status !== 'updated') return result.status;
    const saved: SavedCart = {
      version: 1,
      cart: result.cart,
      store: result.cart.length ? store : null,
      details: details.filter((detail) =>
        result.cart.some((item) => item.productId === detail.productId),
      ),
    };
    this.publish({ busy: true, error: undefined });
    try {
      await this.storage.write(JSON.stringify(saved));
      this.publish(saved);
      return 'updated';
    } catch {
      this.publish({
        error: 'カートを保存できませんでした。空き容量を確認して、もう一度操作してください。',
      });
      return 'storage-error';
    } finally {
      this.publish({ busy: false });
    }
  }
  add = async (store: CartStore, product: CartProduct, confirmed = false) => {
    if (!this.state.ready || this.state.busy) return 'busy';
    if (product.soldout) return 'sold-out';
    const result = addCartItem(
      this.state.cart,
      {
        restaurantId: store.id,
        productId: product.id,
        unitPrice: product.price,
        quantity: 1,
      },
      { confirmRestaurantChange: confirmed },
    );
    if (result.status === 'invalid') {
      this.publish({ error: 'この商品は20点まで追加できます。数量と金額を確認してください。' });
      return result.status;
    }
    const sameStore = this.state.store?.id === store.id;
    const details = sameStore
      ? this.state.details.filter((item) => item.productId !== product.id)
      : [];
    return this.commit(result, store, [
      ...details,
      {
        productId: product.id,
        name: product.name,
        ...(product.photoUrl ? { photoUrl: product.photoUrl } : {}),
      },
    ]);
  };
  clear = async () => {
    if (!this.state.ready || this.state.busy)
      throw new Error('カートの保存中です。再試行してください。');
    const result = await this.commit({ status: 'updated', cart: [] }, null, []);
    if (result !== 'updated')
      throw new Error(
        '注文は受付済みですが、カートを更新できません。同じ内容で再試行してください。',
      );
  };
  setQuantity = async (productId: string, quantity: number) => {
    if (!this.state.ready || this.state.busy) return 'busy';
    return this.commit(
      setCartItemQuantity(this.state.cart, productId, quantity),
      this.state.store,
      this.state.details,
    );
  };
}
