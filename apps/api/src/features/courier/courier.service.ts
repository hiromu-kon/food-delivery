import { DomainError } from '@repo/domain';

import type { createCourierRepository } from './courier.repository';

export function createCourierService(repository: ReturnType<typeof createCourierRepository>) {
  return {
    async me(userId: string) {
      const courier = await repository.find(userId);
      if (!courier) throw new DomainError('FORBIDDEN', '配達員登録を運営に確認してください');
      return { isAvailable: courier.isAvailable };
    },
    async setAvailability(userId: string, isAvailable: boolean) {
      const courier = await repository.setAvailability(userId, isAvailable);
      if (!courier) throw new DomainError('FORBIDDEN', '配達員登録を運営に確認してください');
      return { isAvailable: courier.isAvailable };
    },
  };
}
