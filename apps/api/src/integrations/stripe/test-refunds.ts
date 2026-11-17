import { z } from 'zod';

export const testRefundSchema = z.object({
  id: z.string().min(1),
  paymentIntentId: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.literal('jpy'),
  livemode: z.literal(false),
  status: z.enum(['pending', 'succeeded', 'failed', 'canceled', 'requires_action']),
});
export type TestRefund = z.infer<typeof testRefundSchema>;
export const testRefundPaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  amountReceived: z.number().int().nonnegative(),
  currency: z.literal('jpy'),
  status: z.literal('succeeded'),
  livemode: z.literal(false),
});

export interface TestRefundClient {
  readonly mode: 'test';
  retrievePayment(id: string): Promise<unknown>;
  findRefund(paymentIntentId: string, key: string): Promise<unknown>;
  refund(paymentIntentId: string, amount: number, key: string): Promise<unknown>;
}
