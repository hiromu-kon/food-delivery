import { users, type Db } from '@repo/db';
import { eq } from 'drizzle-orm';

export function createAuthRepository(db: Db) {
  return {
    async findUser(id: string) {
      return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
    },
  };
}
