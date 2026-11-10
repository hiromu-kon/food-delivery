import { z } from 'zod';
import { checkCartOrderability } from '@repo/domain';
import type { SavedCart } from '../cart/cart-state';

export const deliverySchema = z
  .object({
    addressId: z.string().min(1, 'お届け先を選んでください。'),
    fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
    dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).optional(),
    deliveryNote: z.string().trim().max(100, '配達メモは100文字以内で入力してください。'),
  })
  .refine((value) => value.fulfillment !== 'leave_at_door' || !!value.dropoffLocation, {
    message: '置き場所を選んでください。',
    path: ['dropoffLocation'],
  })
  .refine(
    (value) =>
      value.fulfillment !== 'leave_at_door' ||
      value.dropoffLocation !== 'other' ||
      !!value.deliveryNote,
    {
      message: 'その他の置き場所を配達メモに入力してください。',
      path: ['deliveryNote'],
    },
  );
export type Delivery = z.infer<typeof deliverySchema>;
export function orderInput(cart: SavedCart, delivery: Delivery, paymentMethodId: string) {
  const values = deliverySchema.parse(delivery);
  if (checkCartOrderability(cart.items, cart.store.minimumOrderAmount).status !== 'orderable')
    throw new Error('カートの内容と最低注文金額を確認してください。');
  if (!/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId))
    throw new Error('カード情報を確認してください。');
  return {
    storeId: cart.store.id,
    addressId: values.addressId,
    items: cart.items.map((item) => ({ menuItemId: item.productId, quantity: item.quantity })),
    fulfillment: values.fulfillment,
    ...(values.fulfillment === 'leave_at_door' ? { dropoffLocation: values.dropoffLocation } : {}),
    deliveryNote: values.deliveryNote,
    paymentMethodId,
  };
}
