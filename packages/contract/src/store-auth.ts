import type { Store } from '@repo/db';
import { z } from 'zod';

import { authUserSchema } from './auth';

export const staffStoreSchema = z.object({
  id: z.uuid(),
  name: z.string(),
}) satisfies z.ZodType<Pick<Store, 'id' | 'name'>>;

export const storeMeResponseSchema = z.object({
  user: authUserSchema.extend({ role: z.literal('store'), emailVerified: z.literal(true) }),
  store: staffStoreSchema,
});
export type StoreContext = z.infer<typeof storeMeResponseSchema>;
