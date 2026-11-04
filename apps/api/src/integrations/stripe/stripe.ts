import { z } from 'zod';
import { PaymentError, type StripeClient } from './client';

const intentSchema = z.object({
  id: z.string().regex(/^pi_[a-zA-Z0-9_]+$/),
  status: z.string(),
  amount: z.number().int(),
  amount_capturable: z.number().int(),
  currency: z.string(),
  capture_method: z.string(),
  livemode: z.literal(false),
});

/** This initial integration deliberately accepts only test-mode keys. No capture endpoint. */
export function createStripeClient(secret?: string, fetcher: typeof fetch = fetch): StripeClient {
  if (secret && !/^sk_test_[a-zA-Z0-9]+$/.test(secret)) throw new Error('Stripe test key required');
  async function request(path: string, values?: Record<string, string>, key?: string) {
    if (!secret) throw new PaymentError('PAYMENT_UNAVAILABLE');
    try {
      const response = await fetcher(`https://api.stripe.com/v1/payment_intents${path}`, {
        method: values ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Stripe-Version': '2026-10-28.endive',
          ...(key ? { 'Idempotency-Key': key } : {}),
          ...(values ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        ...(values ? { body: new URLSearchParams(values).toString() } : {}),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new PaymentError(
          response.status >= 500 || response.status === 429
            ? 'PAYMENT_UNAVAILABLE'
            : 'PAYMENT_FAILED',
        );
      return intentSchema.parse(await response.json());
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError('PAYMENT_UNAVAILABLE');
    }
  }
  return {
    create: (amount, paymentMethodId, key) =>
      request(
        '',
        {
          amount: String(amount),
          currency: 'jpy',
          capture_method: 'manual',
          confirmation_method: 'manual',
          'payment_method_types[]': 'card',
          payment_method: paymentMethodId,
        },
        key,
      ),
    retrieve: (id) => request(`/${encodeURIComponent(id)}`),
    confirm: (id, key) => request(`/${encodeURIComponent(id)}/confirm`, {}, key),
    cancel: (id, key) => request(`/${encodeURIComponent(id)}/cancel`, {}, key),
  };
}
