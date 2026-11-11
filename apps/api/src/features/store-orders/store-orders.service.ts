import { storeOrderSummarySchema, storeOrderDetailSchema } from '@repo/contract';
import type { Db } from '@repo/db';
import { acceptanceDeadline, assertStoreOrderAction, DomainError } from '@repo/domain';
import {
  PaymentError,
  type StripeClient,
  type PaymentIntent,
} from '../../integrations/stripe/client';
import { createStoreOrderRepository } from './store-orders.repository';

export function createStoreOrderService(
  db: Db,
  stripe: StripeClient,
  repository = createStoreOrderRepository(db),
  now = () => new Date(),
) {
  const summary = (row: Awaited<ReturnType<typeof repository.lock>>) =>
    storeOrderSummarySchema.parse({
      ...row,
      createdAt: row.createdAt.toISOString(),
      acceptanceDeadline: acceptanceDeadline(row.createdAt).toISOString(),
      paymentReconciling:
        (row.status === 'pending' && row.captureStartedAt !== null) ||
        (row.cancellationReason === 'store_rejected' && row.paymentVoidedAt === null),
    });
  function validate(intent: PaymentIntent, row: Awaited<ReturnType<typeof repository.lock>>) {
    if (
      intent.id !== row.paymentIntentId ||
      intent.amount !== row.total ||
      intent.currency !== 'jpy' ||
      intent.capture_method !== 'manual'
    )
      throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
  }
  return {
    async list(userId: string, storeId: string) {
      return (await repository.list(userId, storeId)).map(summary);
    },
    async get(userId: string, storeId: string, id: string) {
      return repository.transaction(async (tx) => {
        const row = await repository.lock(tx, userId, storeId, id);
        return storeOrderDetailSchema.parse({
          ...summary(row),
          items: await repository.items(tx, id),
          subtotal: row.subtotal,
          deliveryFee: row.deliveryFee,
          deliveryNote: row.deliveryNote,
          courier: null,
        });
      });
    },
    async action(
      userId: string,
      storeId: string,
      id: string,
      action: 'accept' | 'reject' | 'ready',
    ) {
      // Reserve before external I/O: a crash cannot let cancellation race an unknown capture.
      await repository.transaction(async (tx) => {
        const row = await repository.lock(tx, userId, storeId, id);
        if (
          action === 'accept' &&
          row.captureStartedAt &&
          ['pending', 'preparing', 'ready'].includes(row.status)
        )
          return;
        if (
          action === 'reject' &&
          row.status === 'canceled' &&
          row.cancellationReason === 'store_rejected'
        )
          return;
        if (row.captureStartedAt && row.status === 'pending')
          throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
        assertStoreOrderAction(row.status, action, row.createdAt, now());
        if (action === 'accept') await repository.update(tx, id, { captureStartedAt: now() });
        if (action === 'reject')
          await repository.update(tx, id, {
            status: 'canceled',
            cancellationReason: 'store_rejected',
          });
        if (action === 'ready') await repository.update(tx, id, { status: 'ready' });
      });
      if (action !== 'ready')
        await repository.transaction(async (tx) => {
          const row = await repository.lock(tx, userId, storeId, id);
          if (action === 'accept' && (row.status === 'preparing' || row.status === 'ready')) return;
          if (action === 'reject' && row.paymentVoidedAt) return;
          if (
            action === 'accept'
              ? row.status !== 'pending' || !row.captureStartedAt
              : row.status !== 'canceled' || row.cancellationReason !== 'store_rejected'
          )
            throw new DomainError('ORDER_INVALID_TRANSITION');
          try {
            let intent = await stripe.retrieve(row.paymentIntentId);
            validate(intent, row);
            if (action === 'accept') {
              if (intent.status === 'requires_capture' && intent.amount_capturable === row.total) {
                // Retries reuse the same key; after retention expires only retrieval is safe.
                if (now().getTime() - row.captureStartedAt!.getTime() >= 23 * 3600000)
                  throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
                intent = await stripe.capture(intent.id, `${id}:store-capture`);
              }
              validate(intent, row);
              if (
                intent.status !== 'succeeded' ||
                intent.amount_received !== row.total ||
                intent.amount_capturable !== 0
              )
                throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              await repository.update(tx, id, { status: 'preparing' });
            } else {
              if (intent.status === 'requires_capture' && intent.amount_capturable === row.total)
                intent = await stripe.cancel(intent.id, `${id}:store-reject`);
              validate(intent, row);
              if (intent.status !== 'canceled')
                throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
              await repository.update(tx, id, { paymentVoidedAt: now() });
            }
          } catch {
            throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
          }
        });
      return this.get(userId, storeId, id);
    },
  };
}
