import { zValidator } from '@hono/zod-validator';
import { orderIdSchema } from '@repo/contract';
import { createCourierOrdersRepository } from './courier-orders.repository';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { createCourierRepository } from './courier.repository';
import { courierAvailabilitySchema } from './courier.schema';
import { createCourierService } from './courier.service';

export function createCourierRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  const deliveries = createCourierOrdersRepository(db);
  const service = createCourierService(createCourierRepository(db));
  return new Hono<AuthEnv>()
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['courier'], true))
    .get('/orders', async (c) => c.json(await deliveries.list(c.get('authUser').id), 200))
    .get('/orders/current', async (c) =>
      c.json(await deliveries.current(c.get('authUser').id), 200),
    )
    .get('/orders/history', async (c) =>
      c.json(await deliveries.history(c.get('authUser').id), 200),
    )
    .get('/orders/:id', zValidator('param', orderIdSchema), async (c) =>
      c.json(await deliveries.detail(c.get('authUser').id, c.req.valid('param').id), 200),
    )
    .post('/orders/:id/accept', zValidator('param', orderIdSchema), async (c) =>
      c.json(await deliveries.accept(c.get('authUser').id, c.req.valid('param').id), 200),
    )
    .post('/orders/:id/receive', zValidator('param', orderIdSchema), async (c) =>
      c.json(await deliveries.receive(c.get('authUser').id, c.req.valid('param').id), 200),
    )
    .post('/orders/:id/deliver', zValidator('param', orderIdSchema), async (c) =>
      c.json(await deliveries.deliver(c.get('authUser').id, c.req.valid('param').id), 200),
    )
    .get('/me', async (c) =>
      c.json({ user: c.get('authUser'), courier: await service.me(c.get('authUser').id) }, 200),
    )
    .patch(
      '/availability',
      zValidator('json', courierAvailabilitySchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.setAvailability(c.get('authUser').id, c.req.valid('json').isAvailable),
          200,
        ),
    );
}
