import type { Courier } from '@repo/db';
import { z } from 'zod';

import { authUserSchema } from './auth';
import { customerOrderItemSchema, orderStatusSchema } from './orders';

export const courierAvailabilitySchema = z.strictObject({
  isAvailable: z.boolean(),
}) satisfies z.ZodType<Pick<Courier, 'isAvailable'>>;
export const courierMeSchema = z.object({
  user: authUserSchema,
  courier: courierAvailabilitySchema,
});
export type CourierMe = z.infer<typeof courierMeSchema>;

export const courierOrderSummarySchema = z.object({
  id: z.uuid(),
  status: orderStatusSchema,
  storeName: z.string(),
  distanceMeters: z.number().nonnegative(),
});
export const courierOrderDetailSchema = courierOrderSummarySchema.extend({
  storeAddress: z.string(),
  address: z.string(),
  building: z.string(),
  items: z.array(customerOrderItemSchema),
  fulfillment: z.enum(['hand_delivery', 'leave_at_door']),
  dropoffLocation: z.enum(['front_door', 'delivery_box', 'other']).nullable(),
  deliveryNote: z.string().optional(),
  isAssignedToMe: z.boolean(),
});
export const courierOrderListSchema = z.object({ orders: z.array(courierOrderSummarySchema) });
export const courierOrderResponseSchema = z.object({ order: courierOrderDetailSchema });
export const courierCurrentOrderSchema = z.object({ order: courierOrderDetailSchema.nullable() });
export const courierDeliveryHistoryItemSchema = z.object({
  id: z.uuid(),
  storeName: z.string(),
  total: z.number().int().nonnegative(),
  deliveredAt: z.iso.datetime(),
});
export const courierDeliveryHistoryResponseSchema = z.object({
  deliveries: z.array(courierDeliveryHistoryItemSchema),
});
export type CourierOrderDetail = z.infer<typeof courierOrderDetailSchema>;
export type CourierDeliveryHistoryItem = z.infer<typeof courierDeliveryHistoryItemSchema>;
