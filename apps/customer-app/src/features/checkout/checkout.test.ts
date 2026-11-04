import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '@repo/contract';
import { AuthRequestError } from '@/features/auth/request';
import type { CartState } from '@/features/cart/cart';
import {
  attemptSchema,
  CheckoutController,
  validateCheckout,
  matchesOrderCart,
  type CheckoutDependencies,
  type CheckoutForm,
} from './checkout';
const storeId = '00000000-0000-4000-8000-000000000001';
const addressId = '00000000-0000-4000-8000-000000000002';
const productId = '00000000-0000-4000-8000-000000000003';
const key = '00000000-0000-4000-8000-000000000004';
const cart: CartState = {
  version: 1,
  ready: true,
  busy: false,
  error: undefined,
  store: { id: storeId, name: '店', minimumOrderAmount: 1000 },
  cart: [{ restaurantId: storeId, productId, unitPrice: 1200, quantity: 2 }],
  details: [{ productId, name: '定食' }],
};
const addresses: DeliveryAddress[] = [
  {
    id: addressId,
    label: '自宅',
    address: '住所',
    building: '',
    deliveryNote: 'saved',
    isDefault: true,
    latitude: 35,
    longitude: 139,
  },
];
const form: CheckoutForm = {
  addressId,
  fulfillment: 'hand_delivery',
  dropoffLocation: '',
  deliveryNote: '',
};
function setup() {
  const dependencies: CheckoutDependencies = {
    uuid: vi.fn(() => key),
    paymentMethod: vi.fn(() => Promise.resolve('pm_test')),
    submit: vi.fn(() => Promise.resolve({ id: 'order-1' })),
    save: vi.fn(async () => {}),
    clearCart: vi.fn(async () => {}),
  };
  return { dependencies, controller: new CheckoutController(dependencies) };
}
describe('checkout validation', () => {
  it('requires orderable cart, a saved address, location and other-location note', () => {
    expect(validateCheckout({ ...cart, cart: [] }, addresses, form)).toBeTruthy();
    expect(
      validateCheckout({ ...cart, cart: [{ ...cart.cart[0]!, quantity: 0 }] }, addresses, form),
    ).toBeTruthy();
    expect(validateCheckout(cart, [], form)).toBeTruthy();
    expect(validateCheckout(cart, addresses, { ...form, fulfillment: 'leave_at_door' })).toContain(
      '置き場所',
    );
    expect(
      validateCheckout(cart, addresses, {
        ...form,
        fulfillment: 'leave_at_door',
        dropoffLocation: 'other',
      }),
    ).toContain('配達メモ');
    expect(
      validateCheckout(cart, addresses, { ...form, deliveryNote: 'a'.repeat(101) }),
    ).toBeTruthy();
    expect(validateCheckout(cart, addresses, form)).toBeUndefined();
  });
  it('rejects malformed persisted attempts', () => {
    expect(attemptSchema.safeParse({ key: 'bad', request: {} }).success).toBe(false);
  });
});
describe('native payment and order flow', () => {
  it('persists before POST and sends IDs and quantities only, omitting handoff location', async () => {
    const { controller, dependencies } = setup();
    await controller.submit(cart, addresses, { ...form, dropoffLocation: 'delivery_box' });
    expect(dependencies.submit).toHaveBeenCalledWith(
      {
        storeId,
        addressId,
        items: [{ menuItemId: productId, quantity: 2 }],
        fulfillment: 'hand_delivery',
        deliveryNote: '',
        paymentMethodId: 'pm_test',
      },
      key,
    );
    expect(vi.mocked(dependencies.save).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(dependencies.submit).mock.invocationCallOrder[0]!,
    );
    expect(controller.getSnapshot().order?.id).toBe('order-1');
    expect(dependencies.clearCart).toHaveBeenCalledOnce();
    expect(dependencies.save).toHaveBeenLastCalledWith(null);
  });
  it('submits leave-at-door and trimmed note', async () => {
    const { controller, dependencies } = setup();
    await controller.submit(cart, addresses, {
      ...form,
      fulfillment: 'leave_at_door',
      dropoffLocation: 'other',
      deliveryNote: ' 横の棚 ',
    });
    expect(dependencies.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        fulfillment: 'leave_at_door',
        dropoffLocation: 'other',
        deliveryNote: '横の棚',
      }),
      key,
    );
  });
  it('does not tokenize invalid forms or send failed payments', async () => {
    const { controller, dependencies } = setup();
    await controller.submit(cart, [], form);
    expect(dependencies.paymentMethod).not.toHaveBeenCalled();
    vi.mocked(dependencies.paymentMethod).mockRejectedValue(
      new AuthRequestError('カード入力エラー'),
    );
    await controller.submit(cart, addresses, form);
    expect(controller.getSnapshot().error).toBe('カード入力エラー');
    expect(dependencies.submit).not.toHaveBeenCalled();
    expect(dependencies.clearCart).not.toHaveBeenCalled();
  });
  it('blocks double submission and keeps the exact request/key after unknown failure and restart', async () => {
    const { controller, dependencies } = setup();
    let reject!: (reason: Error) => void;
    vi.mocked(dependencies.submit).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const first = controller.submit(cart, addresses, form);
    await vi.waitFor(() => expect(dependencies.submit).toHaveBeenCalledOnce());
    expect(controller.getSnapshot().pending).toBe(true);
    await controller.submit(cart, addresses, form);
    reject(new Error('network'));
    await first;
    const attempt = controller.getSnapshot().attempt!;
    const restored = new CheckoutController(dependencies, attempt);
    await restored.submit({ ...cart, cart: [] }, [], { ...form, deliveryNote: 'changed' });
    expect(dependencies.paymentMethod).toHaveBeenCalledOnce();
    expect(dependencies.submit).toHaveBeenLastCalledWith(attempt.request, attempt.key);
    expect(restored.getSnapshot().order).toBeDefined();
  });
  it.each([500, 503])('keeps uncertain HTTP %s pending for same-key recovery', async (status) => {
    const { controller, dependencies } = setup();
    vi.mocked(dependencies.submit).mockRejectedValue(new AuthRequestError('照合中', '', status));
    await controller.submit(cart, addresses, form);
    expect(controller.getSnapshot().attempt).not.toBeNull();
    expect(controller.getSnapshot().rejected).toBe(false);
    expect(dependencies.clearCart).not.toHaveBeenCalled();
  });
  it('requires explicit failure acknowledgement before using a new payment/key', async () => {
    const { controller, dependencies } = setup();
    vi.mocked(dependencies.submit).mockRejectedValueOnce(
      new AuthRequestError('追加認証未対応', '', 402),
    );
    await controller.submit(cart, addresses, form);
    await controller.submit(cart, addresses, form);
    expect(dependencies.submit).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().rejected).toBe(true);
    await controller.resetRejected();
    vi.mocked(dependencies.uuid).mockReturnValue('00000000-0000-4000-8000-000000000005');
    await controller.submit(cart, addresses, form);
    expect(dependencies.paymentMethod).toHaveBeenCalledTimes(2);
    expect(dependencies.submit).toHaveBeenLastCalledWith(
      expect.anything(),
      '00000000-0000-4000-8000-000000000005',
    );
  });
  it('never sends an attempt that could not be saved', async () => {
    const { controller, dependencies } = setup();
    vi.mocked(dependencies.save).mockRejectedValue(new Error('disk full'));
    await controller.submit(cart, addresses, form);
    expect(dependencies.submit).not.toHaveBeenCalled();
  });
});

it('matches only the submitted store and quantities before clearing the cart', async () => {
  const { controller } = setup();
  await controller.submit(cart, addresses, form);
  const request = {
    storeId,
    addressId,
    items: [{ menuItemId: productId, quantity: 2 }],
    fulfillment: 'hand_delivery' as const,
    paymentMethodId: 'pm_test',
  };
  expect(matchesOrderCart(cart, request)).toBe(true);
  expect(
    matchesOrderCart({ ...cart, store: { ...cart.store!, id: 'another-store' } }, request),
  ).toBe(false);
  expect(matchesOrderCart({ ...cart, cart: [{ ...cart.cart[0]!, quantity: 1 }] }, request)).toBe(
    false,
  );
});
it('preserves the attempt when local cleanup fails after server success', async () => {
  const { controller, dependencies } = setup();
  vi.mocked(dependencies.clearCart).mockRejectedValueOnce(new Error('storage unavailable'));
  await controller.submit(cart, addresses, form);
  const attempt = controller.getSnapshot().attempt!;
  expect(attempt).not.toBeNull();
  expect(controller.getSnapshot().order).toBeUndefined();
  await controller.submit(cart, addresses, form);
  expect(dependencies.paymentMethod).toHaveBeenCalledOnce();
  expect(dependencies.submit).toHaveBeenLastCalledWith(attempt.request, attempt.key);
  expect(controller.getSnapshot().order?.id).toBe('order-1');
});
