import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono } from 'hono';
import type { AuthEnv } from '../../middleware/auth';
import type { Geocoder } from '../../integrations/maps/geocoder';
import {
  storeCreateSchema,
  storeUpdateSchema,
  managedStoreIdSchema,
  staffCreateSchema,
} from './store-admin.schema';
import { createStoreAdminService } from './store-admin.service';

export function createStoreAdminRoutes(db: Db, geocoder: Geocoder) {
  const service = createStoreAdminService(db, geocoder);
  return new Hono<AuthEnv>()
    .use('*', async (c, next) => {
      if (new URL(c.req.url).searchParams.size)
        return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      await next();
    })
    .get('/', async (c) => c.json(await service.list(c.get('authUser').id), 200))
    .get(
      '/:storeId',
      zValidator('param', managedStoreIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(await service.get(c.get('authUser').id, c.req.valid('param').storeId), 200),
    )
    .post(
      '/',
      zValidator('json', storeCreateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) => c.json(await service.create(c.get('authUser').id, c.req.valid('json')), 201),
    )
    .patch(
      '/:storeId',
      zValidator('param', managedStoreIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      zValidator('json', storeUpdateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.update(
            c.get('authUser').id,
            c.req.valid('param').storeId,
            c.req.valid('json'),
          ),
          200,
        ),
    )
    .delete(
      '/:storeId',
      zValidator('param', managedStoreIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) => {
        await service.delete(c.get('authUser').id, c.req.valid('param').storeId);
        return c.body(null, 204);
      },
    )
    .post(
      '/:storeId/staff',
      zValidator('param', managedStoreIdSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      zValidator('json', staffCreateSchema, (result, c) => {
        if (!result.success)
          return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
      }),
      async (c) =>
        c.json(
          await service.staff(
            c.get('authUser').id,
            c.req.valid('param').storeId,
            c.req.valid('json'),
          ),
          201,
        ),
    );
}
