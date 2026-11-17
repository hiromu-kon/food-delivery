import { zValidator } from '@hono/zod-validator';
import { adminOrderQuerySchema, orderIdSchema } from '@repo/contract';
import type { Db } from '@repo/db';
import { Hono } from 'hono';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { TestRefundClient } from '../../integrations/stripe/test-refunds';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { createAdminOrderService } from './admin-orders.service';

export function createAdminOrderRoutes(
  auth: AuthService,
  db: Db,
  config: AuthConfig,
  refunds?: TestRefundClient,
) {
  const service = createAdminOrderService(db, refunds);
  const param = zValidator('param', orderIdSchema, (result, c) => {
    if (!result.success)
      return c.json({ code: 'VALIDATION_ERROR', message: '注文IDを確認してください' }, 400);
  });
  return new Hono<AuthEnv>()
    .use(async (c, next) => {
      c.header('Cache-Control', 'no-store');
      await next();
    })
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['admin'], true))
    .get(
      '/',
      zValidator('query', adminOrderQuerySchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '検索条件を確認してください' }, 400);
      }),
      async (c) =>
        c.json({ orders: await service.list(c.get('authUser').id, c.req.valid('query')) }, 200),
    )
    .get('/:id', param, async (c) =>
      c.json({ order: await service.get(c.get('authUser').id, c.req.valid('param').id) }, 200),
    )
    .post('/:id/cancel', param, async (c) =>
      c.json({ order: await service.cancel(c.get('authUser').id, c.req.valid('param').id) }, 200),
    )
    .post('/:id/unassign', param, async (c) =>
      c.json({ order: await service.unassign(c.get('authUser').id, c.req.valid('param').id) }, 200),
    );
}
