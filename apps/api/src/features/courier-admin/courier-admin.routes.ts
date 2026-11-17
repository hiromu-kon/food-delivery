import { zValidator } from '@hono/zod-validator';
import {
  createCourierSchema,
  updateCourierSchema,
  courierResponseSchema,
  courierListResponseSchema,
} from '@repo/contract';
import { accounts, sessions, users, type Db } from '@repo/db';
import { eq } from 'drizzle-orm';
import { DomainError } from '@repo/domain';
import { hashPassword } from 'better-auth/crypto';
import { Hono } from 'hono';
import { z } from 'zod';

import { createCourierAdminRepository, courierCondition } from './courier-admin.repository';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { AuthConfig, AuthService } from '../auth/auth.service';

export function createCourierAdminRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  const repository = createCourierAdminRepository(db);
  return new Hono<AuthEnv>()
    .use(async (c, next) => {
      c.header('Cache-Control', 'no-store');
      await next();
    })
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['admin'], true))
    .onError((error, c) => {
      const cause = error.cause;
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505')
        return c.json(
          {
            code: 'EMAIL_IN_USE',
            message: 'このメールアドレスは使用済みです。別のメールアドレスを入力してください',
          },
          409,
        );
      throw error;
    })
    .get('/', zValidator('query', z.strictObject({})), async (c) =>
      c.json(courierListResponseSchema.parse({ couriers: await repository.list() }), 200),
    )
    .get('/:id', async (c) => {
      const [courier] = await db
        .select()
        .from(users)
        .where(courierCondition(c.req.param('id')));
      if (!courier) throw new DomainError('NOT_FOUND', '配達員が見つかりません');
      return c.json(courierResponseSchema.parse({ courier }), 200);
    })
    .post('/', zValidator('json', createCourierSchema), async (c) => {
      const data = c.req.valid('json');
      const password = await hashPassword(data.password);
      const courier = await repository.mutate(c.get('authUser').id, async (tx) => {
        const id = crypto.randomUUID();
        const [created] = await tx
          .insert(users)
          .values({
            id,
            name: data.name,
            email: data.email,
            phoneNumber: data.phoneNumber,
            role: 'courier',
            emailVerified: true,
          })
          .returning();
        await tx.insert(accounts).values({
          id: crypto.randomUUID(),
          userId: id,
          accountId: id,
          providerId: 'credential',
          password,
        });
        return created;
      });
      return c.json(courierResponseSchema.parse({ courier }), 201);
    })
    .patch('/:id', zValidator('json', updateCourierSchema), async (c) => {
      const data = c.req.valid('json');
      const courier = await repository.mutate(c.get('authUser').id, async (tx) => {
        const [updated] = await tx
          .update(users)
          .set({ ...data, updatedAt: new Date() })
          .where(courierCondition(c.req.param('id')))
          .returning();
        if (!updated) throw new DomainError('NOT_FOUND', '配達員が見つかりません');
        if (data.disabled) await tx.delete(sessions).where(eq(sessions.userId, updated.id));
        return updated;
      });
      return c.json(courierResponseSchema.parse({ courier }), 200);
    })
    .delete('/:id', async (c) => {
      await repository.mutate(c.get('authUser').id, async (tx) => {
        const [deleted] = await tx
          .delete(users)
          .where(courierCondition(c.req.param('id')))
          .returning({ id: users.id });
        if (!deleted) throw new DomainError('NOT_FOUND', '配達員が見つかりません');
      });
      return c.body(null, 204);
    });
}
