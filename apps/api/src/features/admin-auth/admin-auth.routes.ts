import { zValidator } from '@hono/zod-validator';
import { adminMeResponseSchema } from '@repo/contract';
import type { Db } from '@repo/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import type { AuthConfig, AuthService } from '../auth/auth.service';

export function createAdminAuthRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  return new Hono<AuthEnv>()
    .use(async (c, next) => {
      c.header('Cache-Control', 'no-store');
      await next();
    })
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['admin'], true))
    .get(
      '/me',
      zValidator('query', z.strictObject({}), (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      (c) => c.json(adminMeResponseSchema.parse({ user: c.get('authUser') }), 200),
    );
}
