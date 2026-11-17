import { expect, it } from 'vitest';
import { checkoutActionRequiredSchema, checkoutSchema } from './checkout';

it('R-05 accepts only the action-required response with a client secret', () => {
  expect(
    checkoutActionRequiredSchema.parse({
      status: 'requires_action',
      clientSecret: 'pi_synthetic_secret_synthetic',
    }),
  ).toEqual({ status: 'requires_action', clientSecret: 'pi_synthetic_secret_synthetic' });
  for (const value of [
    { status: 'requires_action' },
    { status: 'requires_action', clientSecret: 'invalid' },
    { status: 'pending', clientSecret: 'pi_synthetic_secret_synthetic' },
    {
      status: 'requires_action',
      clientSecret: 'pi_synthetic_secret_synthetic',
      paymentMethodId: 'pm_private',
    },
  ])
    expect(checkoutActionRequiredSchema.safeParse(value).success).toBe(false);
});
it('R-05 never accepts client-supplied intent or authentication results in checkout', () => {
  const input = {
    storeId: '00000000-0000-4000-8000-000000000001',
    addressId: '00000000-0000-4000-8000-000000000002',
    items: [{ menuItemId: '00000000-0000-4000-8000-000000000003', quantity: 1 }],
    fulfillment: 'hand_delivery',
    paymentMethodId: 'pm_synthetic',
  };
  expect(checkoutSchema.safeParse(input).success).toBe(true);
  for (const extra of [
    { paymentIntentId: 'pi_synthetic' },
    { status: 'requires_capture' },
    { clientSecret: 'pi_synthetic_secret_synthetic' },
  ])
    expect(checkoutSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
