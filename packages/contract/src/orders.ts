import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'pending',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'canceled',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderIdSchema = z.object({ id: z.uuid() });

export const customerOrderSummarySchema = z.object({
  id: z.uuid(),
  storeId: z.uuid(),
  storeName: z.string(),
  status: orderStatusSchema,
  total: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
});
export type CustomerOrderSummary = z.infer<typeof customerOrderSummarySchema>;

export const customerOrderItemSchema = z.object({
  menuItemId: z.uuid(),
  name: z.string(),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});
export type CustomerOrderItem = z.infer<typeof customerOrderItemSchema>;

export const customerOrderDetailSchema = customerOrderSummarySchema.extend({
  items: z.array(customerOrderItemSchema),
  subtotal: z.number().int().nonnegative(),
  deliveryFee: z.number().int().nonnegative(),
  address: z.string(),
  building: z.string(),
  dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).nullable(),
  fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
  // Only available after a leave-at-door delivery is completed.
  deliveryPhotoUrl: z.url().nullable(),
});
export type CustomerOrderDetail = z.infer<typeof customerOrderDetailSchema>;

export const customerOrderListResponseSchema = z.object({
  orders: z.array(customerOrderSummarySchema),
});
export type CustomerOrderListResponse = z.infer<typeof customerOrderListResponseSchema>;

export const customerOrderDetailResponseSchema = z.object({ order: customerOrderDetailSchema });
export type CustomerOrderDetailResponse = z.infer<typeof customerOrderDetailResponseSchema>;

export type OrderSummary = CustomerOrderSummary;
export type OrderDetail = CustomerOrderDetail;

export const customerOrderCancellationResponseSchema = z.object({
  order: z.object({ id: z.uuid(), status: z.literal('canceled') }),
});
export type CustomerOrderCancellationResponse = z.infer<
  typeof customerOrderCancellationResponseSchema
>;
