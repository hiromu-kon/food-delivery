import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { createCourierRepository } from './courier.repository';
import { courierAvailabilitySchema } from './courier.schema';
import { createCourierService } from './courier.service';

export function createCourierRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  const service = createCourierService(createCourierRepository(db));
  return new Hono<AuthEnv>()
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['courier'], true))
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
