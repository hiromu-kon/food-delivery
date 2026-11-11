import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';
import type { StoreEnv } from '../../middleware/store-context';
import type { StripeClient } from '../../integrations/stripe/client';
import { orderIdSchema } from './store-orders.schema';
import { createStoreOrderService } from './store-orders.service';

export function createStoreOrderRoutes(db: Db, stripe: StripeClient) {
  const service = createStoreOrderService(db, stripe);
  const param = zValidator('param', orderIdSchema, (result, c) => {
    if (!result.success)
      return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
  });
  return new Hono<StoreEnv>()
    .get('/', async (c) =>
      c.json(
        {
          orders: await service.list(c.get('storeContext').user.id, c.get('storeContext').store.id),
        },
        200,
      ),
    )
    .get('/:id', param, async (c) =>
      c.json(
        {
          order: await service.get(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').id,
          ),
        },
        200,
      ),
    )
    .post('/:id/accept', param, async (c) =>
      c.json(
        {
          order: await service.action(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').id,
            'accept',
          ),
        },
        200,
      ),
    )
    .post('/:id/reject', param, async (c) =>
      c.json(
        {
          order: await service.action(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').id,
            'reject',
          ),
        },
        200,
      ),
    )
    .post('/:id/ready', param, async (c) =>
      c.json(
        {
          order: await service.action(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').id,
            'ready',
          ),
        },
        200,
      ),
    );
}
