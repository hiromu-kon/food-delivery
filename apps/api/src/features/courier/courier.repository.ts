import { couriers, users, type Db } from '@repo/db';
import { and, eq, exists } from 'drizzle-orm';

export function createCourierRepository(db: Db) {
  return {
    async find(userId: string) {
      return (await db.select().from(couriers).where(eq(couriers.userId, userId)))[0];
    },
    async setAvailability(userId: string, isAvailable: boolean) {
      return (
        await db
          .update(couriers)
          .set({ isAvailable, updatedAt: new Date() })
          .where(
            and(
              eq(couriers.userId, userId),
              exists(
                db
                  .select({ id: users.id })
                  .from(users)
                  .where(
                    and(
                      eq(users.id, userId),
                      eq(users.role, 'courier'),
                      eq(users.disabled, false),
                      eq(users.emailVerified, true),
                    ),
                  ),
              ),
            ),
          )
          .returning()
      )[0];
    },
  };
}
