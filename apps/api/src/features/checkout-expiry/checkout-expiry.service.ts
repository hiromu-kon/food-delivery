import type { Db } from '@repo/db';
import {
  PaymentError,
  type PaymentIntent,
  type StripeClient,
} from '../../integrations/stripe/client';
import { createCheckoutExpiryRepository } from './checkout-expiry.repository';

export function createCheckoutExpiryService(
  db: Db,
  stripe: StripeClient,
  repository = createCheckoutExpiryRepository(db),
  now = () => new Date(),
) {
  return {
    async run() {
      const cutoff = new Date(now().getTime() - 23 * 3600000);
      const result = { completed: 0, failed: 0 };
      let after: string | undefined;
      for (;;) {
        const candidates = await repository.candidates(cutoff, after);
        if (!candidates.length) return result;
        for (const { id } of candidates) {
          after = id;
          try {
            const completed = await repository.transaction(async (tx) => {
              const { attempt, order } = await repository.lock(tx, id);
              if (!attempt || order || attempt.paymentVoidedAt || attempt.createdAt > cutoff)
                return false;
              if (!attempt.paymentIntentId)
                throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              const validate = (intent: PaymentIntent) => {
                if (
                  intent.livemode !== false ||
                  intent.id !== attempt.paymentIntentId ||
                  intent.amount !== attempt.quote.total ||
                  intent.currency !== 'jpy' ||
                  intent.capture_method !== 'manual' ||
                  (intent.amount_received ?? 0) !== 0
                )
                  throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              };
              let intent = await stripe.retrieve(attempt.paymentIntentId);
              validate(intent);
              if (intent.status !== 'canceled') {
                if (
                  ![
                    'requires_action',
                    'requires_confirmation',
                    'requires_capture',
                    'requires_payment_method',
                  ].includes(intent.status) ||
                  intent.amount_capturable !==
                    (intent.status === 'requires_capture' ? attempt.quote.total : 0)
                )
                  throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
                intent = await stripe.cancel(intent.id, `${id}:cancel`);
                validate(intent);
              }
              if (intent.status !== 'canceled' || intent.amount_capturable !== 0)
                throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              await repository.complete(tx, id, now());
              return true;
            });
            if (completed) result.completed++;
          } catch {
            // Retrieve on the next run resolves lost cancel/commit responses without recreating intents.
            result.failed++;
          }
        }
      }
    },
  };
}
