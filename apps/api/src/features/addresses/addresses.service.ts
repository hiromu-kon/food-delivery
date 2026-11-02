import { addressSchema, type AddressUpdate, type AddressInput } from '@repo/contract';
import type { Db } from '@repo/db';
import { DomainError } from '@repo/domain';

import type { Geocoder } from '../../integrations/maps/geocoder';
import { createAddressRepository } from './addresses.repository';

export function createAddressService(db: Db, geocoder: Geocoder) {
  const repository = createAddressRepository(db);
  const notFound = () => new DomainError('NOT_FOUND', 'お届け先が見つかりません');
  return {
    async list(userId: string) {
      return (await repository.list(userId)).map((row) => addressSchema.parse(row));
    },
    async get(userId: string, id: string) {
      const row = await repository.find(userId, id);
      if (!row) throw notFound();
      return addressSchema.parse(row);
    },
    async create(userId: string, input: AddressInput) {
      const coordinates = await geocoder.geocode(input.address);
      return addressSchema.parse(await repository.insert({ ...input, ...coordinates, userId }));
    },
    async update(userId: string, id: string, input: AddressUpdate) {
      // 他人の行や存在しない行は地図 API を呼ぶ前に同じ404にする。
      const existing = await repository.find(userId, id);
      if (!existing) throw notFound();
      const coordinates =
        input.address !== undefined && input.address !== existing.address
          ? await geocoder.geocode(input.address)
          : {};
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const row = await repository.update(userId, id, { ...changes, ...coordinates });
      if (!row) throw notFound();
      return addressSchema.parse(row);
    },
    async delete(userId: string, id: string) {
      if (!(await repository.delete(userId, id))) throw notFound();
    },
  };
}
