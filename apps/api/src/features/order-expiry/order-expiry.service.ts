import type { Db } from '@repo/db';
import { acceptanceDeadline, acceptanceExpiryCutoff } from '@repo/domain';
import { PaymentError, type StripeClient } from '../../integrations/stripe/client';
import { createOrderExpiryRepository } from './order-expiry.repository';

export function createOrderExpiryService(
  db: Db,
  stripe: StripeClient,
  repository = createOrderExpiryRepository(db),
  now = () => new Date(),
) {
  return {
    async run() {
      const cutoff = acceptanceExpiryCutoff(now());
      const result = { completed: 0, failed: 0 };
      let after: string | undefined;
      for (;;) {
        const candidates = await repository.candidates(cutoff, after);
        if (candidates.length === 0) return result;
        for (const { id } of candidates) {
          after = id;
          try {
            await repository.transaction(async (tx) => {
              const row = await repository.lock(tx, id);
              if (
                row?.status === 'pending' &&
                !row.captureStartedAt &&
                now() >= acceptanceDeadline(row.createdAt)
              )
                await repository.update(tx, id, {
                  status: 'canceled',
                  cancellationReason: 'expired',
                });
            });
            const completed = await repository.transaction(async (tx) => {
              const row = await repository.lock(tx, id);
              if (
                !row ||
                row.status !== 'canceled' ||
                row.cancellationReason !== 'expired' ||
                row.captureStartedAt ||
                row.paymentVoidedAt
              )
                return false;
              const validate = (intent: Awaited<ReturnType<StripeClient['retrieve']>>) => {
                if (
                  intent.id !== row.paymentIntentId ||
                  intent.amount !== row.total ||
                  intent.currency !== 'jpy' ||
                  intent.capture_method !== 'manual'
                )
                  throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              };
              let intent = await stripe.retrieve(row.paymentIntentId);
              validate(intent);
              if (intent.status === 'requires_capture' && intent.amount_capturable === row.total)
                intent = await stripe.cancel(intent.id, `${id}:expiry`);
              validate(intent);
              if (intent.status !== 'canceled' || intent.amount_capturable !== 0)
                throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              await repository.update(tx, id, { paymentVoidedAt: now() });
              return true;
            });
            if (completed) result.completed++;
          } catch {
            // The durable expired reservation lets the next run reconcile external/DB failures.
            result.failed++;
          }
        }
      }
    },
  };
}
