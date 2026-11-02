import { zValidator } from '@hono/zod-validator';
import type { Db } from '@repo/db';
import { Hono, type Context } from 'hono';

import type { AuthConfig, AuthService } from '../auth/auth.service';
import type { Geocoder } from '../../integrations/maps/geocoder';
import { requireRole, requireSession, type AuthEnv } from '../../middleware/auth';
import { addressIdSchema, addressInputSchema, addressUpdateSchema } from './addresses.schema';
import { createAddressService } from './addresses.service';

const invalid = (result: { success: boolean }, c: Context) => {
  if (!result.success)
    return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
};

export function createAddressRoutes(
  auth: AuthService,
  db: Db,
  config: AuthConfig,
  geocoder: Geocoder,
) {
  const service = createAddressService(db, geocoder);
  return new Hono<AuthEnv>()
    .use(requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]))
    .use(requireRole(['customer']))
    .get('/', async (c) => c.json({ addresses: await service.list(c.get('authUser').id) }, 200))
    .post('/', zValidator('json', addressInputSchema, invalid), async (c) =>
      c.json({ address: await service.create(c.get('authUser').id, c.req.valid('json')) }, 201),
    )
    .get('/:id', zValidator('param', addressIdSchema, invalid), async (c) =>
      c.json({ address: await service.get(c.get('authUser').id, c.req.valid('param').id) }, 200),
    )
    .patch(
      '/:id',
      zValidator('param', addressIdSchema, invalid),
      zValidator('json', addressUpdateSchema, invalid),
      async (c) =>
        c.json(
          {
            address: await service.update(
              c.get('authUser').id,
              c.req.valid('param').id,
              c.req.valid('json'),
            ),
          },
          200,
        ),
    )
    .delete('/:id', zValidator('param', addressIdSchema, invalid), async (c) => {
      await service.delete(c.get('authUser').id, c.req.valid('param').id);
      return c.json({ status: true } as const, 200);
    });
}
