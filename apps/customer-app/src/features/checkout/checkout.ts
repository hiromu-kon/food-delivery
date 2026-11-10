import type { DeliveryAddress } from '@repo/contract';
import { checkCartOrderability } from '@repo/domain';
import type { CartState } from '@/features/cart/cart';
import { z } from 'zod';
import { AuthRequestError, errorMessage } from '@/features/auth/request';

export type Fulfillment = 'hand_delivery' | 'leave_at_door';
export type DropoffLocation = 'front_door' | 'delivery_box' | 'other';
export type CheckoutForm = {
  addressId: string;
  fulfillment: Fulfillment;
  dropoffLocation: DropoffLocation | '';
  deliveryNote: string;
};
export type OrderRequest = {
  storeId: string;
  addressId: string;
  items: { menuItemId: string; quantity: number }[];
  fulfillment: Fulfillment;
  dropoffLocation?: DropoffLocation | undefined;
  deliveryNote?: string | undefined;
  paymentMethodId: string;
};
export type OrderReceipt = { id: string };
export const attemptSchema = z.object({
  key: z.uuid(),
  request: z.strictObject({
    storeId: z.uuid(),
    addressId: z.uuid(),
    items: z
      .array(z.strictObject({ menuItemId: z.uuid(), quantity: z.number().int().min(1).max(20) }))
      .min(1)
      .max(100),
    fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
    dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).optional(),
    deliveryNote: z.string().max(100).optional(),
    paymentMethodId: z.string().regex(/^pm_[a-zA-Z0-9_]+$/),
  }),
});
export type Attempt = { key: string; request: OrderRequest };
export type CheckoutDependencies = {
  uuid: () => string;
  paymentMethod: () => Promise<string>;
  submit: (request: OrderRequest, key: string) => Promise<OrderReceipt>;
  save: (attempt: Attempt | null) => Promise<void>;
  clearCart: (request: OrderRequest) => Promise<void>;
};
export function validateCheckout(
  cart: CartState,
  addresses: DeliveryAddress[],
  form: CheckoutForm,
) {
  if (
    cart.cart.length > 100 ||
    !cart.ready ||
    cart.busy ||
    !cart.store ||
    checkCartOrderability(cart.cart, cart.store.minimumOrderAmount).status !== 'orderable'
  )
    return 'カートの数量と最低注文金額を確認してください。';
  if (!addresses.some((address) => address.id === form.addressId))
    return 'お届け先を選択してください。';
  if (form.fulfillment === 'leave_at_door' && !form.dropoffLocation)
    return '置き場所を選択してください。';
  if (form.deliveryNote.length > 100) return '配達メモは100文字以内で入力してください。';
  if (
    form.fulfillment === 'leave_at_door' &&
    form.dropoffLocation === 'other' &&
    !form.deliveryNote.trim()
  )
    return 'その他の置き場所を配達メモに入力してください。';
  return undefined;
}
export function matchesOrderCart(cart: CartState, request: OrderRequest) {
  return (
    cart.store?.id === request.storeId &&
    cart.cart.length === request.items.length &&
    request.items.every((item) =>
      cart.cart.some(
        (entry) => entry.productId === item.menuItemId && entry.quantity === item.quantity,
      ),
    )
  );
}
export class CheckoutController {
  private state: {
    pending: boolean;
    attempt: Attempt | null;
    order?: OrderReceipt;
    error?: string | undefined;
    rejected?: boolean;
  } = { pending: false, attempt: null };
  private listeners = new Set<() => void>();
  constructor(
    private dependencies: CheckoutDependencies,
    attempt: Attempt | null = null,
  ) {
    this.state.attempt = attempt;
  }
  setPaymentMethod = (paymentMethod: CheckoutDependencies['paymentMethod']) => {
    this.dependencies.paymentMethod = paymentMethod;
  };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<typeof this.state>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  resetRejected = async () => {
    if (!this.state.rejected || this.state.pending) return;
    this.publish({ pending: true });
    try {
      await this.dependencies.save(null);
      this.publish({ attempt: null, rejected: false, error: undefined });
    } catch (error) {
      this.publish({ error: errorMessage(error) });
    } finally {
      this.publish({ pending: false });
    }
  };
  submit = async (cart: CartState, addresses: DeliveryAddress[], form: CheckoutForm) => {
    if (this.state.pending || this.state.order || this.state.rejected) return;
    if (!this.state.attempt) {
      const error = validateCheckout(cart, addresses, form);
      if (error) {
        this.publish({ error });
        return;
      }
    }
    this.publish({ pending: true, error: undefined });
    try {
      let attempt = this.state.attempt;
      if (!attempt) {
        const paymentMethodId = await this.dependencies.paymentMethod();
        if (!/^pm_[a-zA-Z0-9_]+$/.test(paymentMethodId))
          throw new AuthRequestError('カード情報を確認してください。');
        attempt = {
          key: this.dependencies.uuid(),
          request: {
            storeId: cart.store!.id,
            addressId: form.addressId,
            items: cart.cart.map((item) => ({
              menuItemId: item.productId,
              quantity: item.quantity,
            })),
            fulfillment: form.fulfillment,
            ...(form.fulfillment === 'leave_at_door' && form.dropoffLocation
              ? { dropoffLocation: form.dropoffLocation }
              : {}),
            deliveryNote: form.deliveryNote.trim(),
            paymentMethodId,
          },
        };
        // Persist before sending: a timeout or app restart must reuse the same authorization.
        await this.dependencies.save(attempt);
        this.publish({ attempt });
      }
      const order = await this.dependencies.submit(attempt.request, attempt.key);
      // Keep the attempt until local cleanup succeeds so retry can recover a successful response.
      await this.dependencies.clearCart(attempt.request);
      await this.dependencies.save(null);
      this.publish({ order, attempt: null });
    } catch (error) {
      this.publish({
        error: errorMessage(error),
        rejected: error instanceof AuthRequestError && [400, 402, 404, 422].includes(error.status),
      });
    } finally {
      this.publish({ pending: false });
    }
  };
}
