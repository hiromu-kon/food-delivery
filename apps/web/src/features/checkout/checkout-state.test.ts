import { describe, expect, it } from 'vitest';
import { deliverySchema, orderInput } from './checkout-state';
import type { SavedCart } from '../cart/cart-state';

const cart: SavedCart = {
  version: 1,
  store: { id: 'store', name: '食堂', minimumOrderAmount: 1000 },
  items: [{ restaurantId: 'store', productId: 'menu', name: '定食', unitPrice: 600, quantity: 2 }],
};
describe('checkout validation and authoritative order input', () => {
  it('requires a saved address, a dropoff location, and a description for other', () => {
    const base = { addressId: 'address', fulfillment: 'leave_at_door', deliveryNote: '' };
    expect(deliverySchema.safeParse(base).success).toBe(false);
    expect(deliverySchema.safeParse({ ...base, dropoffLocation: 'front_door' }).success).toBe(true);
    expect(deliverySchema.safeParse({ ...base, dropoffLocation: 'other' }).success).toBe(false);
    expect(
      deliverySchema.safeParse({ ...base, dropoffLocation: 'other', deliveryNote: 'ベンチの上' })
        .success,
    ).toBe(true);
    expect(
      deliverySchema.safeParse({ ...base, addressId: '', dropoffLocation: 'front_door' }).success,
    ).toBe(false);
    expect(
      deliverySchema.safeParse({
        ...base,
        dropoffLocation: 'delivery_box',
        deliveryNote: 'a'.repeat(101),
      }).success,
    ).toBe(false);
  });
  it('sends only IDs, quantities, delivery preferences and Stripe payment method', () => {
    expect(
      orderInput(
        cart,
        {
          addressId: 'address',
          fulfillment: 'hand_delivery',
          dropoffLocation: 'front_door',
          deliveryNote: '  ',
        },
        'pm_test',
      ),
    ).toEqual({
      storeId: 'store',
      addressId: 'address',
      items: [{ menuItemId: 'menu', quantity: 2 }],
      fulfillment: 'hand_delivery',
      paymentMethodId: 'pm_test',
      deliveryNote: '',
    });
    expect(
      orderInput(
        cart,
        {
          addressId: 'address',
          fulfillment: 'leave_at_door',
          dropoffLocation: 'delivery_box',
          deliveryNote: '  201号室  ',
        },
        'pm_test',
      ),
    ).toMatchObject({ dropoffLocation: 'delivery_box', deliveryNote: '201号室' });
  });
  it('rejects unorderable carts and invalid payment methods', () => {
    const delivery = {
      addressId: 'address',
      fulfillment: 'hand_delivery' as const,
      deliveryNote: '',
    };
    expect(() => orderInput({ ...cart, items: [] }, delivery, 'pm_test')).toThrow();
    expect(() =>
      orderInput(
        { ...cart, store: { ...cart.store, minimumOrderAmount: 2000 } },
        delivery,
        'pm_test',
      ),
    ).toThrow();
    expect(() => orderInput(cart, delivery, 'tok_card')).toThrow();
  });
});
