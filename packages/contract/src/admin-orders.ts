import { z } from 'zod';
import { customerOrderDetailSchema, orderStatusSchema } from './orders';

export const adminOrderQuerySchema = z.strictObject({
  status: orderStatusSchema.optional(),
  storeId: z.uuid().optional(),
  date: z.iso.date().optional(),
  id: z.uuid().optional(),
});
export const adminOrderSchema = customerOrderDetailSchema.extend({
  courierId: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  paymentStatus: z.enum(['authorized', 'captured', 'voided', 'reconciling', 'refunded']),
  statusHistory: z.array(z.object({ status: orderStatusSchema, createdAt: z.iso.datetime() })),
  history: z.array(
    z.object({
      action: z.enum(['cancel', 'unassign']),
      previousStatus: orderStatusSchema,
      createdAt: z.iso.datetime(),
    }),
  ),
});
export const adminOrderListResponseSchema = z.object({ orders: z.array(adminOrderSchema) });
export const adminOrderDetailResponseSchema = z.object({ order: adminOrderSchema });
export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
