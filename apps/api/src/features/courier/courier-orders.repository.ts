import { couriers, orderItems, orders, orderStatusHistory, stores, users, type Db } from '@repo/db';
import { distanceMeters, DomainError } from '@repo/domain';
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';

const activeStatuses = ['preparing', 'ready', 'delivering'] as const;
const waiting = and(inArray(orders.status, ['preparing', 'ready']), isNull(orders.courierId));
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function authorize(tx: Tx, userId: string) {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('share');
  if (!user || user.role !== 'courier' || user.disabled || !user.emailVerified)
    throw new DomainError('FORBIDDEN', '配達員登録を運営に確認してください');
  const [courier] = await tx
    .select()
    .from(couriers)
    .where(eq(couriers.userId, userId))
    .for('update');
  if (!courier) throw new DomainError('FORBIDDEN', '配達員登録を運営に確認してください');
  return courier;
}

async function detail(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select({
      id: orders.id,
      status: orders.status,
      courierId: orders.courierId,
      customerPhoneNumber: users.phoneNumber,
      storeName: stores.name,
      storeAddress: stores.address,
      storeLatitude: stores.latitude,
      storeLongitude: stores.longitude,
      latitude: orders.latitude,
      longitude: orders.longitude,
      address: orders.address,
      building: orders.building,
      fulfillment: orders.fulfillment,
      dropoffLocation: orders.dropoffLocation,
      deliveryNote: orders.deliveryNote,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(and(eq(orders.id, id), or(waiting, eq(orders.courierId, userId))));
  if (!row)
    throw new DomainError('NOT_FOUND', '配達待ちの注文が見つかりません。一覧を更新してください');
  const {
    courierId,
    customerPhoneNumber,
    deliveryNote,
    storeLatitude,
    storeLongitude,
    latitude,
    longitude,
    ...order
  } = row;
  return {
    ...order,
    distanceMeters: distanceMeters(
      { latitude: storeLatitude, longitude: storeLongitude },
      { latitude, longitude },
    ),
    isAssignedToMe: courierId === userId,
    ...(courierId === userId && { customerPhoneNumber }),
    ...(courierId === userId && { deliveryNote }),
    items: await tx
      .select({
        menuItemId: orderItems.menuItemId,
        name: orderItems.name,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id)),
  };
}

export function createCourierOrdersRepository(db: Db) {
  return {
    list(userId: string) {
      return db.transaction(async (tx) => {
        const courier = await authorize(tx, userId);
        if (!courier.isAvailable) return { orders: [] };
        const rows = await tx
          .select({
            id: orders.id,
            status: orders.status,
            storeName: stores.name,
            storeLatitude: stores.latitude,
            storeLongitude: stores.longitude,
            latitude: orders.latitude,
            longitude: orders.longitude,
          })
          .from(orders)
          .innerJoin(stores, eq(stores.id, orders.storeId))
          .where(waiting)
          .orderBy(asc(orders.createdAt), asc(orders.id));
        return {
          orders: rows.map(({ storeLatitude, storeLongitude, latitude, longitude, ...order }) => ({
            ...order,
            distanceMeters: distanceMeters(
              { latitude: storeLatitude, longitude: storeLongitude },
              { latitude, longitude },
            ),
          })),
        };
      });
    },
    current(userId: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, userId);
        const [order] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.courierId, userId), inArray(orders.status, activeStatuses)));
        return { order: order ? await detail(tx, userId, order.id) : null };
      });
    },
    detail(userId: string, id: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, userId);
        return { order: await detail(tx, userId, id) };
      });
    },
    accept(userId: string, id: string) {
      return db.transaction(async (tx) => {
        const courier = await authorize(tx, userId);
        const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
        if (!order)
          throw new DomainError('NOT_FOUND', '注文が見つかりません。一覧を更新してください');
        if (order.courierId === userId && activeStatuses.some((status) => status === order.status))
          return { order: await detail(tx, userId, id) };
        if (order.courierId || (order.status !== 'preparing' && order.status !== 'ready'))
          throw new DomainError(
            'ORDER_ALREADY_ASSIGNED',
            'ほかの配達員が担当したか、配達待ちではなくなりました',
          );
        if (!courier.isAvailable)
          throw new DomainError('COURIER_UNAVAILABLE', '稼働中に切り替えてください');
        const [active] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.courierId, userId), inArray(orders.status, activeStatuses)));
        if (active) throw new DomainError('COURIER_BUSY', '担当中の配達を確認してください');
        await tx.update(orders).set({ courierId: userId }).where(eq(orders.id, id));
        return { order: await detail(tx, userId, id) };
      });
    },
    receive(userId: string, id: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, userId);
        const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
        if (!order || order.courierId !== userId)
          throw new DomainError('NOT_FOUND', '担当中の注文が見つかりません');
        if (order.status === 'delivering') return { order: await detail(tx, userId, id) };
        if (order.status !== 'ready')
          throw new DomainError('ORDER_INVALID_TRANSITION', '準備完了の注文だけ受け取れます');
        await tx.update(orders).set({ status: 'delivering' }).where(eq(orders.id, id));
        await tx.insert(orderStatusHistory).values({ orderId: id, status: 'delivering' });
        return { order: await detail(tx, userId, id) };
      });
    },
    deliver(userId: string, id: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, userId);
        const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
        if (!order || order.courierId !== userId)
          throw new DomainError('NOT_FOUND', '担当中の注文が見つかりません');
        if (order.status === 'delivered') return { order: await detail(tx, userId, id) };
        if (order.status !== 'delivering')
          throw new DomainError('ORDER_INVALID_TRANSITION', '配達中の注文だけ完了できます');
        if (order.fulfillment === 'leave_at_door')
          throw new DomainError(
            'DELIVERY_PHOTO_REQUIRED',
            '置き配写真の保存が利用できるまで配達完了にできません',
          );
        await tx.update(orders).set({ status: 'delivered' }).where(eq(orders.id, id));
        await tx.insert(orderStatusHistory).values({ orderId: id, status: 'delivered' });
        return { order: await detail(tx, userId, id) };
      });
    },
    history(userId: string) {
      return db.transaction(async (tx) => {
        await authorize(tx, userId);
        const rows = await tx
          .select({
            id: orders.id,
            storeName: stores.name,
            total: orders.total,
            deliveredAt: orderStatusHistory.createdAt,
          })
          .from(orderStatusHistory)
          .innerJoin(
            orders,
            and(
              eq(orderStatusHistory.orderId, orders.id),
              eq(orderStatusHistory.status, 'delivered'),
            ),
          )
          .innerJoin(stores, eq(stores.id, orders.storeId))
          .where(and(eq(orders.courierId, userId), eq(orders.status, 'delivered')))
          .orderBy(desc(orderStatusHistory.createdAt), desc(orders.id))
          .limit(100);
        return {
          deliveries: rows.map((row) => ({ ...row, deliveredAt: row.deliveredAt.toISOString() })),
        };
      });
    },
  };
}
