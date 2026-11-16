import { z } from 'zod';

import { authUserSchema } from './auth';

export const adminMeResponseSchema = z.object({
  user: authUserSchema.extend({ role: z.literal('admin'), emailVerified: z.literal(true) }),
});
export type AdminContext = z.infer<typeof adminMeResponseSchema>;
