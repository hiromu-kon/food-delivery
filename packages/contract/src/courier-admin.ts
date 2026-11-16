import type { User } from '@repo/db';
import { z } from 'zod';

export const courierProfileSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phoneNumber: z.string().regex(/^\+?[0-9]{10,15}$/),
});
export const createCourierSchema = courierProfileSchema.extend({
  password: z.string().min(8).max(128),
});
export const updateCourierSchema = courierProfileSchema.extend({ disabled: z.boolean() });
export const courierSchema = courierProfileSchema.strip().extend({
  id: z.string(),
  disabled: z.boolean(),
}) satisfies z.ZodType<Pick<User, 'id' | 'name' | 'email' | 'phoneNumber' | 'disabled'>>;
export const courierResponseSchema = z.object({ courier: courierSchema });
export const courierListResponseSchema = z.object({ couriers: z.array(courierSchema) });
