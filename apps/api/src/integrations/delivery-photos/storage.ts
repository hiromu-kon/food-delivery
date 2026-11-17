import type { Db, DeliveryPhoto } from '@repo/db';

export type PhotoTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export interface DeliveryPhotoStorage {
  put(tx: PhotoTransaction, photo: DeliveryPhoto): Promise<void>;
  get(
    tx: PhotoTransaction,
    orderId: string,
    courierId: string,
    now: Date,
  ): Promise<DeliveryPhoto | undefined>;
  complete(tx: PhotoTransaction, orderId: string, expiresAt: Date): Promise<void>;
  purge(now: Date): Promise<void>;
}
