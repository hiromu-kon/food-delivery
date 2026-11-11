import { z } from 'zod';

export const checkoutSchema = z
  .strictObject({
    storeId: z.uuid(),
    addressId: z.uuid(),
    items: z
      .array(z.strictObject({ menuItemId: z.uuid(), quantity: z.number().int().min(1).max(20) }))
      .min(1)
      .max(100),
    fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
    dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).optional(),
    deliveryNote: z.string().trim().max(100).optional(),
    paymentMethodId: z
      .string()
      .regex(/^pm_[a-zA-Z0-9_]+$/)
      .max(200),
  })
  .superRefine((value, ctx) => {
    if ((value.fulfillment === 'leave_at_door') !== Boolean(value.dropoffLocation))
      ctx.addIssue({
        code: 'custom',
        path: ['dropoffLocation'],
        message: '受け取り方法を確認してください',
      });
    if (value.dropoffLocation === 'other' && !value.deliveryNote)
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryNote'],
        message: '置き場所を指定してください',
      });
    if (new Set(value.items.map((item) => item.menuItemId)).size !== value.items.length)
      ctx.addIssue({ code: 'custom', path: ['items'], message: '商品が重複しています' });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;
