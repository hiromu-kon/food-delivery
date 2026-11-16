import { adminOrderSchema, type AdminOrderQuery } from '@repo/contract';
import {
  orders,
  orderItems,
  orderAdminEvents,
  orderStatusHistory,
  stores,
  users,
  type Db,
} from '@repo/db';
import {
  assertAdminCancellation,
  assertAdminUnassignment,
  canRetryRefund,
  japanOrderDateRange,
  DomainError,
} from '@repo/domain';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { PaymentError } from '../../integrations/stripe/client';
import {
  testRefundSchema,
  testRefundPaymentSchema,
  type TestRefundClient,
} from '../../integrations/stripe/test-refunds';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export function createAdminOrderService(db: Db, refunds?: TestRefundClient) {
  async function authorize(tx: Tx, actorId: string) {
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for('share');
    if (!actor || actor.role !== 'admin' || actor.disabled || !actor.emailVerified)
      throw new DomainError('FORBIDDEN', '運営権限を確認してください');
  }
  async function lock(tx: Tx, id: string) {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!order) throw new DomainError('NOT_FOUND', '注文が見つかりません');
    return order;
  }
  async function detail(tx: Tx, id: string) {
    const [row] = await tx
      .select({ order: orders, storeName: stores.name, storePhotoUrl: stores.photoUrl })
      .from(orders)
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(eq(orders.id, id));
    if (!row) throw new DomainError('NOT_FOUND', '注文が見つかりません');
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.menuItemId);
    const history = await tx
      .select()
      .from(orderAdminEvents)
      .where(eq(orderAdminEvents.orderId, id))
      .orderBy(orderAdminEvents.createdAt, orderAdminEvents.id);
    const statusHistory = await tx
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, id))
      .orderBy(orderStatusHistory.createdAt, orderStatusHistory.id);
    const o = row.order;
    return adminOrderSchema.parse({
      ...o,
      storeName: row.storeName,
      storePhotoUrl: row.storePhotoUrl,
      createdAt: o.createdAt.toISOString(),
      items,
      deliveryPhotoUrl: null,
      paymentStatus: o.refundedAt
        ? 'refunded'
        : o.refundStartedAt
          ? 'reconciling'
          : o.paymentVoidedAt
            ? 'voided'
            : o.status === 'canceled' || (o.captureStartedAt && o.status === 'pending')
              ? 'reconciling'
              : o.status === 'pending'
                ? 'authorized'
                : 'captured',
      statusHistory: statusHistory.map((e) => ({
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
      history: history.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    });
  }
  return {
    list: (actorId: string, query: AdminOrderQuery) =>
      db.transaction(async (tx) => {
        await authorize(tx, actorId);
        const range = query.date ? japanOrderDateRange(query.date) : undefined;
        const rows = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              query.status ? eq(orders.status, query.status) : undefined,
              query.storeId ? eq(orders.storeId, query.storeId) : undefined,
              query.id ? eq(orders.id, query.id) : undefined,
              range ? gte(orders.createdAt, range.start) : undefined,
              range ? lt(orders.createdAt, range.end) : undefined,
            ),
          )
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(100);
        return Promise.all(rows.map((row) => detail(tx, row.id)));
      }),
    get: (actorId: string, id: string) =>
      db.transaction(async (tx) => {
        await authorize(tx, actorId);
        return detail(tx, id);
      }),
    async cancel(actorId: string, id: string) {
      if (!refunds || refunds.mode !== 'test') throw new PaymentError('PAYMENT_UNAVAILABLE');
      await db.transaction(async (tx) => {
        await authorize(tx, actorId);
        const order = await lock(tx, id);
        assertAdminCancellation(order.status, order.cancellationReason);
        if (order.refundStartedAt) return;
        await tx.insert(orderStatusHistory).values({ orderId: id, status: 'canceled' });
        await tx
          .update(orders)
          .set({ status: 'canceled', cancellationReason: 'admin', refundStartedAt: new Date() })
          .where(eq(orders.id, id));
        await tx.insert(orderAdminEvents).values({
          orderId: id,
          actorId,
          action: 'cancel',
          previousStatus: order.status,
          courierId: order.courierId,
        });
      });
      return db.transaction(async (tx) => {
        await authorize(tx, actorId);
        const order = await lock(tx, id);
        assertAdminCancellation(order.status, order.cancellationReason);
        if (!order.refundedAt) {
          try {
            const payment = testRefundPaymentSchema.parse(
              await refunds.retrievePayment(order.paymentIntentId),
            );
            if (
              payment.livemode !== false ||
              payment.id !== order.paymentIntentId ||
              payment.amount !== order.total ||
              payment.amountReceived !== order.total ||
              payment.currency !== 'jpy' ||
              payment.status !== 'succeeded'
            )
              throw new Error('Payment mismatch');
            const key = `admin-refund:${id}`;
            let refund = testRefundSchema
              .nullable()
              .parse(await refunds.findRefund(order.paymentIntentId, key));
            if (!refund) {
              if (!order.refundStartedAt || !canRetryRefund(order.refundStartedAt, new Date()))
                throw new Error('Refund requires reconciliation');
              refund = testRefundSchema.parse(
                await refunds.refund(order.paymentIntentId, order.total, key),
              );
            }
            if (
              refund.livemode !== false ||
              refund.paymentIntentId !== order.paymentIntentId ||
              refund.amount !== order.total ||
              refund.currency !== 'jpy' ||
              refund.status !== 'succeeded' ||
              !refund.id
            )
              throw new Error('Refund unconfirmed');
            await tx
              .update(orders)
              .set({ refundedAt: new Date(), refundId: refund.id, courierId: null })
              .where(eq(orders.id, id));
          } catch {
            throw new PaymentError('PAYMENT_RECONCILIATION_REQUIRED');
          }
        }
        return detail(tx, id);
      });
    },
    unassign: (actorId: string, id: string) =>
      db.transaction(async (tx) => {
        await authorize(tx, actorId);
        const order = await lock(tx, id);
        assertAdminUnassignment(order.status);
        if (order.courierId) {
          await tx.update(orders).set({ courierId: null }).where(eq(orders.id, id));
          await tx.insert(orderAdminEvents).values({
            orderId: id,
            actorId,
            action: 'unassign',
            previousStatus: order.status,
            courierId: order.courierId,
          });
        }
        return detail(tx, id);
      }),
  };
}
