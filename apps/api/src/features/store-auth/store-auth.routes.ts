import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import { requireSession } from '../../middleware/auth';
import { requireStoreContext, type StoreEnv } from '../../middleware/store-context';
import type { AuthConfig, AuthService } from '../auth/auth.service';
import { storeMeQuerySchema } from './store-auth.schema';

export function createStoreAuthRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  return new Hono<StoreEnv>()
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireStoreContext(db))
    .get(
      '/me',
      zValidator('query', storeMeQuerySchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      (c) => c.json(c.get('storeContext'), 200),
    );
}
