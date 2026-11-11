import {
  addresses,
  checkoutAttempts,
  menuItems,
  orderItems,
  orders,
  orderSettings,
  stores,
  type Db,
  type CheckoutQuote,
} from '@repo/db';
import {
  assertCustomerCancellation,
  calculateCartTotals,
  checkCartOrderability,
  distanceMeters,
  DomainError,
  isWithinDeliveryRadius,
} from '@repo/domain';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CheckoutInput } from './orders.schema';

// Customer summary projection excludes payment, address, and internal attempt fields.
const customerOrderColumns = {
  id: orders.id,
  storeId: orders.storeId,
  storeName: stores.name,
  storePhotoUrl: stores.photoUrl,
  status: orders.status,
  total: orders.total,
  createdAt: orders.createdAt,
};

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
const reject = () => {
  throw new DomainError(
    'ORDER_NOT_ORDERABLE',
    '店舗・商品・お届け先・最低注文金額を確認してください',
  );
};

export function createOrderRepository(db: Db) {
  return {
    async lockCancellation(tx: Tx, userId: string, id: string) {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, id), eq(orders.userId, userId)))
        .for('update');
      if (!order) throw new DomainError('NOT_FOUND', '注文が見つかりません');
      if (order.captureStartedAt) throw new DomainError('ORDER_NOT_CANCELABLE', '決済確認中です');
      assertCustomerCancellation(order.status, order.cancellationReason);
      return order;
    },
    async reserveCancellation(tx: Tx, id: string) {
      await tx
        .update(orders)
        .set({ status: 'canceled', cancellationReason: 'customer' })
        .where(eq(orders.id, id));
    },
    async completeCancellation(tx: Tx, id: string) {
      await tx.update(orders).set({ paymentVoidedAt: new Date() }).where(eq(orders.id, id));
    },
    async listForCustomer(userId: string) {
      return db
        .select(customerOrderColumns)
        .from(orders)
        .innerJoin(stores, eq(stores.id, orders.storeId))
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt), desc(orders.id));
    },
    async detailForCustomer(userId: string, id: string) {
      const [order] = await db
        .select({
          ...customerOrderColumns,
          subtotal: orders.subtotal,
          deliveryFee: orders.deliveryFee,
          fulfillment: orders.fulfillment,
          address: orders.address,
          building: orders.building,
          dropoffLocation: orders.dropoffLocation,
        })
        .from(orders)
        .innerJoin(stores, eq(stores.id, orders.storeId))
        .where(and(eq(orders.userId, userId), eq(orders.id, id)));
      if (!order) return undefined;
      const items = await db
        .select({
          menuItemId: orderItems.menuItemId,
          name: orderItems.name,
          unitPrice: orderItems.unitPrice,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(eq(orders.userId, userId), eq(orders.id, id)))
        .orderBy(orderItems.menuItemId);
      return { ...order, items };
    },
    transaction: <T>(action: (tx: Tx) => Promise<T>) => db.transaction(action),
    async quote(tx: Tx, userId: string, input: CheckoutInput): Promise<CheckoutQuote> {
      // Locks are retained through authorization and commit; concurrent pause/soldout/price edits wait.
      const [store] = await tx
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .for('share');
      const [address] = await tx
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, userId)))
        .for('share');
      const [settings] = await tx
        .select()
        .from(orderSettings)
        .where(eq(orderSettings.id, 1))
        .for('share');
      if (!address) throw new DomainError('NOT_FOUND', 'お届け先が見つかりません');
      if (!store || !settings || !store.isAcceptingOrders) return reject();
      if (!isWithinDeliveryRadius(distanceMeters(store, address), store.deliveryRadiusMeters))
        return reject();
      const products = await tx
        .select()
        .from(menuItems)
        .where(
          inArray(
            menuItems.id,
            input.items.map((item) => item.menuItemId),
          ),
        )
        .orderBy(menuItems.id)
        .for('share');
      const items = input.items.map((item) => {
        const product = products.find((p) => p.id === item.menuItemId);
        if (!product || product.storeId !== store.id || product.soldout) return reject();
        return {
          menuItemId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
        };
      });
      const cart = items.map((item) => ({
        ...item,
        restaurantId: store.id,
        productId: item.menuItemId,
      }));
      const totals = calculateCartTotals(cart, settings.deliveryFee);
      if (
        totals.status !== 'ok' ||
        checkCartOrderability(cart, store.minimumOrderAmount).status !== 'orderable' ||
        totals.total > 99999999
      )
        return reject();
      return {
        storeId: store.id,
        address: address.address,
        building: address.building,
        latitude: address.latitude,
        longitude: address.longitude,
        deliveryNote: input.deliveryNote ?? address.deliveryNote,
        fulfillment: input.fulfillment,
        dropoffLocation: input.dropoffLocation ?? null,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        items,
      };
    },
    async attempt(userId: string, key: string, hash: string, input: CheckoutInput) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(checkoutAttempts)
          .where(
            and(eq(checkoutAttempts.userId, userId), eq(checkoutAttempts.idempotencyKey, key)),
          );
        if (existing) return existing;
        const quote = await this.quote(tx, userId, input);
        await tx
          .insert(checkoutAttempts)
          .values({ userId, idempotencyKey: key, requestHash: hash, quote })
          .onConflictDoNothing();
        const [row] = await tx
          .select()
          .from(checkoutAttempts)
          .where(
            and(eq(checkoutAttempts.userId, userId), eq(checkoutAttempts.idempotencyKey, key)),
          );
        if (!row) throw new Error('Checkout not saved');
        return row;
      });
    },
    async lock(tx: Tx, id: string) {
      const [row] = await tx
        .select()
        .from(checkoutAttempts)
        .where(eq(checkoutAttempts.id, id))
        .for('update');
      if (!row) throw new Error('Checkout missing');
      return row;
    },
    async result(tx: Tx, id: string) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id));
      if (!order) return undefined;
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id))
        .orderBy(orderItems.menuItemId);
      return { ...order, items };
    },
    async setIntent(id: string, paymentIntentId: string) {
      await db.update(checkoutAttempts).set({ paymentIntentId }).where(eq(checkoutAttempts.id, id));
    },
    async fail(tx: Tx, id: string) {
      await tx.update(checkoutAttempts).set({ failed: 1 }).where(eq(checkoutAttempts.id, id));
    },
    async insert(
      tx: Tx,
      id: string,
      userId: string,
      paymentIntentId: string,
      quote: CheckoutQuote,
    ) {
      const { items, ...values } = quote;
      await tx.insert(orders).values({ ...values, id, userId, paymentIntentId, status: 'pending' });
      await tx.insert(orderItems).values(items.map((item) => ({ ...item, orderId: id })));
      const order = await this.result(tx, id);
      if (!order) throw new Error('Order not saved');
      return order;
    },
  };
}
