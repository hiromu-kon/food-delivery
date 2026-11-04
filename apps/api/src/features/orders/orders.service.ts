import type { Db } from '@repo/db';
import { DomainError } from '@repo/domain';
import { PaymentError, type StripeClient } from '../../integrations/stripe/client';
import { createOrderRepository } from './orders.repository';
import { checkoutSchema, type CheckoutInput } from './orders.schema';

// JSONB does not preserve object key order. Normalize nested snapshot keys for comparison.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry: unknown) => canonical(entry));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  return value;
}

export function createOrderService(
  db: Db,
  stripe: StripeClient,
  repository = createOrderRepository(db),
) {
  return {
    async checkout(userId: string, key: string, raw: CheckoutInput) {
      const input = checkoutSchema.parse(raw);
      input.items.sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(input)),
      );
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const attempt = await repository.attempt(userId, key, hash, input);
      if (attempt.requestHash !== hash)
        throw new DomainError('IDEMPOTENCY_CONFLICT', '同じキーでは同じ注文内容を送信してください');
      // Never recreate an unknown intent once Stripe's minimum 24h key retention has elapsed.
      if (!attempt.paymentIntentId && Date.now() - attempt.createdAt.getTime() > 23 * 3600000)
        throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
      let intentId = attempt.paymentIntentId;
      if (!intentId) {
        const intent = await stripe.create(
          attempt.quote.total,
          input.paymentMethodId,
          `${attempt.id}:create`,
        );
        intentId = intent.id;
        // Creation is unconfirmed: DB failure here cannot authorize any money.
        await repository.setIntent(attempt.id, intentId);
      }
      const id = intentId;
      try {
        return await repository.transaction(async (tx) => {
          const current = await repository.lock(tx, attempt.id);
          const existing = await repository.result(tx, attempt.id);
          if (existing) return existing;
          if (current.failed) throw new PaymentError('PAYMENT_FAILED');
          const quote = await repository.quote(tx, userId, input);
          if (JSON.stringify(canonical(quote)) !== JSON.stringify(canonical(attempt.quote)))
            throw new DomainError(
              'ORDER_NOT_ORDERABLE',
              '注文内容が変わりました。確認して再注文してください',
            );
          let intent = await stripe.retrieve(id);
          if (intent.status === 'requires_confirmation')
            intent = await stripe.confirm(id, `${attempt.id}:confirm`);
          if (
            intent.status !== 'requires_capture' ||
            intent.capture_method !== 'manual' ||
            intent.currency !== 'jpy' ||
            intent.amount !== quote.total ||
            intent.amount_capturable !== quote.total
          )
            throw new PaymentError('PAYMENT_FAILED');
          return repository.insert(tx, attempt.id, userId, id, quote);
        });
      } catch (error) {
        // Serialize compensation against retries, and resolve ambiguous COMMIT before canceling.
        try {
          const committed = await repository.transaction(async (tx) => {
            await repository.lock(tx, attempt.id);
            const existing = await repository.result(tx, attempt.id);
            if (existing) return existing;
            await repository.fail(tx, attempt.id);
            try {
              const intent = await stripe.retrieve(id);
              if (intent.status !== 'canceled') {
                const canceled = await stripe.cancel(id, `${attempt.id}:cancel`);
                if (canceled.status !== 'canceled') return { cleanupFailed: true } as const;
              }
            } catch {
              return { cleanupFailed: true } as const;
            }
            return undefined;
          });
          if (committed && 'cleanupFailed' in committed)
            throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
          if (committed) return committed;
        } catch {
          // Durable attempt+intent survives; same-key retry reconciles, never reports success.
          throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
        }
        throw error;
      }
    },
  };
}
