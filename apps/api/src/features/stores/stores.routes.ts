import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import { createMenuRoutes } from '../menu/menu.routes';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import { storeSearchQuerySchema } from './stores.schema';
import { createStoreService } from './stores.service';

export function createStoreRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  const service = createStoreService(db);
  return new Hono<AuthEnv>()
    .use('/:storeId/menu', async (c, next) => {
      c.header('Cache-Control', 'no-store');
      await next();
    })
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['customer']))
    .route('/', createMenuRoutes(db))
    .get(
      '/',
      zValidator('query', storeSearchQuerySchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          { stores: await service.search(c.get('authUser').id, c.req.valid('query').addressId) },
          200,
        ),
    );
}
