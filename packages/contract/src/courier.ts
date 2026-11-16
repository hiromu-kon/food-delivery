import type { Courier } from '@repo/db';
import { z } from 'zod';

import { authUserSchema } from './auth';

export const courierAvailabilitySchema = z.strictObject({
  isAvailable: z.boolean(),
}) satisfies z.ZodType<Pick<Courier, 'isAvailable'>>;
export const courierMeSchema = z.object({
  user: authUserSchema,
  courier: courierAvailabilitySchema,
});
export type CourierMe = z.infer<typeof courierMeSchema>;
