import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';

import type { StoreEnv } from '../../middleware/store-context';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  soldoutInputSchema,
  categoryIdSchema,
  itemIdSchema,
} from './menu-management.schema';
import { createMenuManagementService } from './menu-management.service';

export function createMenuManagementRoutes(db: Db) {
  const service = createMenuManagementService(db);
  return new Hono<StoreEnv>()
    .use('*', async (c, next) => {
      if (new URL(c.req.url).searchParams.size > 0)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      await next();
    })
    .get('/', async (c) =>
      c.json(await service.get(c.get('storeContext').user.id, c.get('storeContext').store.id), 200),
    )
    .get(
      '/categories/:categoryId',
      zValidator('param', categoryIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.getCategory(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').categoryId,
          ),
          200,
        ),
    )
    .post(
      '/categories',
      zValidator('json', categoryCreateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.createCategory(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('json'),
          ),
          201,
        ),
    )
    .patch(
      '/categories/:categoryId',
      zValidator('param', categoryIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      zValidator('json', categoryUpdateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.updateCategory(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').categoryId,
            c.req.valid('json'),
          ),
          200,
        ),
    )
    .delete(
      '/categories/:categoryId',
      zValidator('param', categoryIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) => {
        await service.deleteCategory(
          c.get('storeContext').user.id,
          c.get('storeContext').store.id,
          c.req.valid('param').categoryId,
        );
        return c.body(null, 204);
      },
    )
    .get(
      '/items/:itemId',
      zValidator('param', itemIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.getItem(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').itemId,
          ),
          200,
        ),
    )
    .post(
      '/items',
      zValidator('json', itemCreateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.createItem(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('json'),
          ),
          201,
        ),
    )
    .patch(
      '/items/:itemId',
      zValidator('param', itemIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      zValidator('json', itemUpdateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.updateItem(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').itemId,
            c.req.valid('json'),
          ),
          200,
        ),
    )
    .delete(
      '/items/:itemId',
      zValidator('param', itemIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) => {
        await service.deleteItem(
          c.get('storeContext').user.id,
          c.get('storeContext').store.id,
          c.req.valid('param').itemId,
        );
        return c.body(null, 204);
      },
    )
    .patch(
      '/items/:itemId/soldout',
      zValidator('param', itemIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      zValidator('json', soldoutInputSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.updateItem(
            c.get('storeContext').user.id,
            c.get('storeContext').store.id,
            c.req.valid('param').itemId,
            c.req.valid('json'),
          ),
          200,
        ),
    );
}
