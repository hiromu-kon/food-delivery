import { authUserSchema, storeSchema } from '@repo/contract';
import type { Db } from '@repo/db';
import { DomainError } from '@repo/domain';
import { hashPassword } from 'better-auth/crypto';
import type { z } from 'zod';

import type { Geocoder } from '../../integrations/maps/geocoder';
import type { staffCreateSchema, storeCreateSchema, storeUpdateSchema } from './store-admin.schema';
import { createStoreAdminRepository } from './store-admin.repository';

async function conflict<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
    if (code === '23505')
      throw new DomainError('ADMIN_CONFLICT', 'このメールアドレスは既に使用されています');
    if (code === '23503')
      throw new DomainError(
        'ADMIN_CONFLICT',
        '注文履歴がある店舗は削除できません。受付を停止してください',
      );
    throw error;
  }
}
export function createStoreAdminService(db: Db, geocoder: Geocoder) {
  const repository = createStoreAdminRepository(db);
  return {
    async list(userId: string) {
      return { stores: (await repository.list(userId)).map((row) => storeSchema.parse(row)) };
    },
    async get(userId: string, id: string) {
      return { store: storeSchema.parse(await repository.get(userId, id)) };
    },
    async create(userId: string, input: z.infer<typeof storeCreateSchema>) {
      const coordinates = await geocoder.geocode(input.address);
      return {
        store: storeSchema.parse(await repository.create(userId, { ...input, ...coordinates })),
      };
    },
    async update(userId: string, id: string, input: z.infer<typeof storeUpdateSchema>) {
      await repository.get(userId, id);
      const coordinates = input.address === undefined ? {} : await geocoder.geocode(input.address);
      return {
        store: storeSchema.parse(
          await repository.update(userId, id, {
            ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
            ...coordinates,
          }),
        ),
      };
    },
    delete(userId: string, id: string) {
      return conflict(() => repository.delete(userId, id));
    },
    async staff(userId: string, id: string, input: z.infer<typeof staffCreateSchema>) {
      await repository.get(userId, id);
      const password = await hashPassword(input.password);
      return {
        staff: authUserSchema.parse(
          await conflict(() => repository.staff(userId, id, input, password)),
        ),
      };
    },
  };
}
