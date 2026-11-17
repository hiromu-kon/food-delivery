import { deliveryPhotos, type Db } from '@repo/db';
import { and, eq, gt, lte } from 'drizzle-orm';
import type { DeliveryPhotoStorage } from './storage';

export function createPostgresDeliveryPhotoStorage(db: Db): DeliveryPhotoStorage {
  return {
    async put(tx, photo) {
      await tx.insert(deliveryPhotos).values(photo).onConflictDoUpdate({
        target: deliveryPhotos.orderId,
        set: photo,
      });
    },
    async get(tx, orderId, courierId, now) {
      const [photo] = await tx
        .select()
        .from(deliveryPhotos)
        .where(
          and(
            eq(deliveryPhotos.orderId, orderId),
            eq(deliveryPhotos.courierId, courierId),
            gt(deliveryPhotos.expiresAt, now),
          ),
        )
        .for('share');
      return photo;
    },
    async complete(tx, orderId, expiresAt) {
      await tx.update(deliveryPhotos).set({ expiresAt }).where(eq(deliveryPhotos.orderId, orderId));
    },
    async purge(now) {
      await db.delete(deliveryPhotos).where(lte(deliveryPhotos.expiresAt, now));
    },
  };
}
