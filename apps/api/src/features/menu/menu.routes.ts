import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import type { AuthEnv } from '../../middleware/auth';
import { menuParamsSchema, menuQuerySchema } from './menu.schema';
import { createMenuService } from './menu.service';

export function createMenuRoutes(db: Db) {
  const service = createMenuService(db);
  return new Hono<AuthEnv>().get(
    '/:storeId/menu',
    zValidator('param', menuParamsSchema, (result, c) => {
      if (!result.success)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
    }),
    async (c, next) => {
      // Honoのquery抽出で無視される空キーも含め、queryパラメータは一切受け付けない。
      if (new URL(c.req.url).searchParams.size > 0)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      await next();
    },
    zValidator('query', menuQuerySchema, (result, c) => {
      if (!result.success)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
    }),
    async (c) => c.json(await service.get(c.req.valid('param').storeId), 200),
  );
}
