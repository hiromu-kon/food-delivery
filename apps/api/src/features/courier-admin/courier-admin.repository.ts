import { users, type Db } from '@repo/db';
import { DomainError } from '@repo/domain';
import { and, asc, eq } from 'drizzle-orm';

export function createCourierAdminRepository(db: Db) {
  return {
    list: () =>
      db
        .select()
        .from(users)
        .where(eq(users.role, 'courier'))
        .orderBy(asc(users.name), asc(users.id)),
    async mutate<T>(
      adminId: string,
      operation: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
    ) {
      return db.transaction(async (tx) => {
        const [admin] = await tx.select().from(users).where(eq(users.id, adminId)).for('share');
        if (!admin || admin.role !== 'admin' || admin.disabled || !admin.emailVerified)
          throw new DomainError('FORBIDDEN', '運営権限を確認してください');
        return operation(tx);
      });
    },
  };
}
export const courierCondition = (id: string) => and(eq(users.id, id), eq(users.role, 'courier'));
