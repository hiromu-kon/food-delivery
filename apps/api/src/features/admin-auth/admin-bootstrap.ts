import { randomUUID } from 'node:crypto';

import { accounts, users, type Db } from '@repo/db';
import { hashPassword } from 'better-auth/crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const adminBootstrapSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/),
});

export async function bootstrapAdmin(db: Db, input: unknown) {
  const data = adminBootstrapSchema.parse(input);
  const password = await hashPassword(data.password);
  await db.transaction(async (tx) => {
    // 初期発行同士の競合で複数の運営が作られないよう、DB 単位で直列化する。
    await tx.execute(sql`select pg_advisory_xact_lock(160071)`);
    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);
    if (existing.length) throw new Error('運営アカウントは既に存在します');
    const id = randomUUID();
    await tx.insert(users).values({
      id,
      name: data.name,
      email: data.email,
      phoneNumber: data.phoneNumber,
      role: 'admin',
      emailVerified: true,
    });
    await tx.insert(accounts).values({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: 'credential',
      password,
    });
  });
}
