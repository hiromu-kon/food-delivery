import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import type { StoreEnv } from '../../middleware/store-context';
import { storeAcceptanceInputSchema } from './store-acceptance.schema';
import { createStoreAcceptanceService } from './store-acceptance.service';

// 親の /store ルートで requireSession / requireStoreContext を適用する。
export function createStoreAcceptanceRoutes(db: Db) {
  const service = createStoreAcceptanceService(db);
  return new Hono<StoreEnv>().patch(
    '/acceptance',
    async (c, next) => {
      if (new URL(c.req.url).searchParams.size > 0)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      await next();
    },
    zValidator('json', storeAcceptanceInputSchema, (result, c) => {
      if (!result.success)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
    }),
    async (c) =>
      c.json(
        await service.update(
          c.get('storeContext').user.id,
          c.get('storeContext').store.id,
          c.req.valid('json').isAcceptingOrders,
        ),
        200,
      ),
  );
}
