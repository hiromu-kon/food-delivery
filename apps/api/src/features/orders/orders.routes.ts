import { orderIdSchema } from '@repo/contract';
import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { StripeClient } from '../../integrations/stripe/client';
import { checkoutSchema } from './orders.schema';
import { createOrderService } from './orders.service';

export function createOrderRoutes(
  auth: AuthService,
  db: Db,
  config: AuthConfig,
  stripe: StripeClient,
) {
  const service = createOrderService(db, stripe);
  return new Hono<AuthEnv>()
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['customer'], true))
    .post(
      '/:id/cancel',
      zValidator('param', orderIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json({ order: await service.cancel(c.get('authUser').id, c.req.valid('param').id) }, 200),
    )
    .get('/', async (c) => c.json({ orders: await service.list(c.get('authUser').id) }, 200))
    .get(
      '/:id',
      zValidator('param', orderIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json({ order: await service.get(c.get('authUser').id, c.req.valid('param').id) }, 200),
    )
    .post(
      '/',
      zValidator('json', checkoutSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) => {
        const key = z.uuid().safeParse(c.req.header('Idempotency-Key'));
        if (!key.success)
          return c.json(
            { code: 'VALIDATION_ERROR', message: 'Idempotency-Key UUIDを指定してください' },
            400,
          );
        const order = await service.checkout(c.get('authUser').id, key.data, c.req.valid('json'));
        // Delivery notes and Stripe identifiers are private; do not expose them to other roles.
        return c.json({ order }, 201);
      },
    );
}
