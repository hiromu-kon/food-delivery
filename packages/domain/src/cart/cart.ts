import { cartQuantityRange } from './quantity';

export type CartItem = Readonly<{
  restaurantId: string;
  productId: string;
  unitPrice: number;
  quantity: number;
}>;

export type Cart = readonly CartItem[];

export type CartInvalidReason =
  'invalid-cart' | 'invalid-item' | 'invalid-quantity' | 'invalid-money' | 'unsafe-total';

type Invalid = { status: 'invalid'; reason: CartInvalidReason };
export type CartChangeResult =
  | { status: 'updated'; cart: Cart }
  | { status: 'confirmation-required'; cart: Cart; restaurantId: string }
  | Invalid;

export const defaultCartDeliveryFee = 300;

function isMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validateItem(item: CartItem): CartInvalidReason | null {
  if (!item.restaurantId.trim() || !item.productId.trim()) return 'invalid-item';
  if (
    !Number.isInteger(item.quantity) ||
    item.quantity < cartQuantityRange.min ||
    item.quantity > cartQuantityRange.max
  ) {
    return 'invalid-quantity';
  }
  if (!isMoney(item.unitPrice)) return 'invalid-money';
  return null;
}

function subtotal(cart: Cart): { status: 'ok'; subtotal: number } | Invalid {
  let amount = 0;
  const products = new Set<string>();
  for (const item of cart) {
    const reason = validateItem(item);
    if (reason) return { status: 'invalid', reason };
    if (item.restaurantId !== cart[0]?.restaurantId || products.has(item.productId)) {
      return { status: 'invalid', reason: 'invalid-cart' };
    }
    products.add(item.productId);
    const lineTotal = item.unitPrice * item.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(amount + lineTotal)) {
      return { status: 'invalid', reason: 'unsafe-total' };
    }
    amount += lineTotal;
  }
  return { status: 'ok', subtotal: amount };
}

function updated(cart: Cart): CartChangeResult {
  const result = subtotal(cart);
  return result.status === 'invalid' ? result : { status: 'updated', cart };
}

/** 同商品への追加は数量を加算し、渡された単価に更新する。 */
export function addCartItem(
  cart: Cart,
  item: CartItem,
  options: { confirmRestaurantChange?: boolean } = {},
): CartChangeResult {
  const existing = subtotal(cart);
  if (existing.status === 'invalid') return existing;
  const reason = validateItem(item);
  if (reason) return { status: 'invalid', reason };
  // 確認を出す前にも新商品の金額が計算可能か検証する。
  const incoming = subtotal([item]);
  if (incoming.status === 'invalid') return incoming;
  if (cart.length > 0 && cart[0]?.restaurantId !== item.restaurantId) {
    return options.confirmRestaurantChange === true
      ? updated([{ ...item }])
      : { status: 'confirmation-required', cart, restaurantId: item.restaurantId };
  }
  const previous = cart.find((entry) => entry.productId === item.productId);
  return updated(
    previous
      ? cart.map((entry) =>
          entry.productId === item.productId
            ? { ...item, quantity: previous.quantity + item.quantity }
            : entry,
        )
      : [...cart, { ...item }],
  );
}

/** 既存の数量UIに合わせて 0 は削除として扱う。存在しない商品は変更しない。 */
export function setCartItemQuantity(
  cart: Cart,
  productId: string,
  quantity: number,
): CartChangeResult {
  const existing = subtotal(cart);
  if (existing.status === 'invalid') return existing;
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > cartQuantityRange.max) {
    return { status: 'invalid', reason: 'invalid-quantity' };
  }
  return updated(
    quantity === 0
      ? cart.filter((item) => item.productId !== productId)
      : cart.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
  );
}

export function removeCartItem(cart: Cart, productId: string): CartChangeResult {
  return setCartItemQuantity(cart, productId, 0);
}

export function clearCart(): Cart {
  return [];
}

export type CartTotalsResult =
  { status: 'ok'; subtotal: number; deliveryFee: number; total: number } | Invalid;

/** 表示用にも利用可能。注文時はAPIが取得した価格で再計算する。 */
export function calculateCartTotals(
  cart: Cart,
  deliveryFee = defaultCartDeliveryFee,
): CartTotalsResult {
  if (!isMoney(deliveryFee)) return { status: 'invalid', reason: 'invalid-money' };
  const result = subtotal(cart);
  if (result.status === 'invalid') return result;
  const chargedDeliveryFee = cart.length === 0 ? 0 : deliveryFee;
  const total = result.subtotal + chargedDeliveryFee;
  if (!Number.isSafeInteger(total)) return { status: 'invalid', reason: 'unsafe-total' };
  return { status: 'ok', subtotal: result.subtotal, deliveryFee: chargedDeliveryFee, total };
}

export type CartOrderabilityResult =
  | { status: 'orderable'; shortfall: 0 }
  | { status: 'below-minimum'; shortfall: number }
  | { status: 'empty'; shortfall: number }
  | Invalid;

/** R-04 の最低金額判定のみ。受付状態・在庫・決済等の注文可否は呼び出し側が確認する。 */
export function checkCartOrderability(cart: Cart, minimumOrderAmount = 0): CartOrderabilityResult {
  if (!isMoney(minimumOrderAmount)) return { status: 'invalid', reason: 'invalid-money' };
  const result = subtotal(cart);
  if (result.status === 'invalid') return result;
  const shortfall = Math.max(0, minimumOrderAmount - result.subtotal);
  if (cart.length === 0) return { status: 'empty', shortfall };
  return shortfall > 0
    ? { status: 'below-minimum', shortfall }
    : { status: 'orderable', shortfall: 0 };
}
