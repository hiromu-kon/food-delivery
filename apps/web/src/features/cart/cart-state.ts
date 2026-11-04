import type { MenuResponse } from '@repo/contract';
import {
  addCartItem,
  calculateCartTotals,
  checkCartOrderability,
  setCartItemQuantity,
} from '@repo/domain';
import { z } from 'zod';

const savedCartSchema = z.object({
  version: z.literal(1),
  store: z.object({
    id: z.string().min(1),
    name: z.string(),
    minimumOrderAmount: z.number().int().nonnegative().safe(),
  }),
  items: z.array(
    z.object({
      restaurantId: z.string().min(1),
      productId: z.string().min(1),
      unitPrice: z.number(),
      quantity: z.number(),
      name: z.string(),
      photoUrl: z.string().nullable().optional(),
    }),
  ),
});
export type SavedCart = z.infer<typeof savedCartSchema>;
export type MenuProduct = MenuResponse['categories'][number]['items'][number];
export function restoreCart(raw: string | null): SavedCart | null {
  if (!raw) return null;
  try {
    const parsed = savedCartSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const value = parsed.data;
    if (!value.items.length || value.items.some((item) => item.restaurantId !== value.store.id))
      return null;
    if (
      calculateCartTotals(value.items).status !== 'ok' ||
      checkCartOrderability(value.items, value.store.minimumOrderAmount).status === 'invalid'
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export type CartSnapshot = { ready: boolean; cart: SavedCart | null; notice: string };
const initial: CartSnapshot = { ready: false, cart: null, notice: '' };
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class LocalCart {
  private state = initial;
  private listeners = new Set<() => void>();
  constructor(
    readonly key: string,
    private storage: () => StorageAccess = () => window.localStorage,
  ) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.state.ready) {
      try {
        this.state = {
          ready: true,
          cart: restoreCart(this.storage().getItem(this.key)),
          notice: '',
        };
      } catch {
        this.state = {
          ready: true,
          cart: null,
          notice: 'カートを復元できませんでした。この画面での変更は保存できない場合があります。',
        };
      }
      this.emit();
    }
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  private save(cart: SavedCart | null) {
    let notice = '';
    try {
      if (cart) this.storage().setItem(this.key, JSON.stringify(cart));
      else this.storage().removeItem(this.key);
    } catch {
      notice = 'カートを保存できませんでした。再読み込みすると変更が失われる場合があります。';
    }
    this.state = { ready: true, cart, notice };
    this.emit();
  }
  add(store: MenuResponse['store'], item: MenuProduct, confirmRestaurantChange = false) {
    if (!this.state.ready || item.soldout) return 'unavailable';
    const result = addCartItem(
      this.state.cart?.items ?? [],
      { restaurantId: store.id, productId: item.id, unitPrice: item.price, quantity: 1 },
      { confirmRestaurantChange },
    );
    if (result.status !== 'updated') return result.status;
    const names = new Map(this.state.cart?.items.map((entry) => [entry.productId, entry.name]));
    names.set(item.id, item.name);
    const photos = new Map(
      this.state.cart?.items.map((entry) => [entry.productId, entry.photoUrl]),
    );
    photos.set(item.id, item.photoUrl);
    this.save({
      version: 1,
      store: { id: store.id, name: store.name, minimumOrderAmount: store.minimumOrderAmount },
      items: result.cart.map((entry) => ({
        ...entry,
        name: names.get(entry.productId) ?? item.name,
        photoUrl: photos.get(entry.productId) ?? null,
      })),
    });
    return 'updated';
  }
  setQuantity(productId: string, quantity: number) {
    const saved = this.state.cart;
    if (!saved) return;
    const result = setCartItemQuantity(saved.items, productId, quantity);
    if (result.status !== 'updated') return;
    this.save(
      result.cart.length
        ? {
            ...saved,
            items: result.cart.map((entry) => ({
              ...entry,
              name: saved.items.find((item) => item.productId === entry.productId)!.name,
              photoUrl:
                saved.items.find((item) => item.productId === entry.productId)!.photoUrl ?? null,
            })),
          }
        : null,
    );
  }
}
