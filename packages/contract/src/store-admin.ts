import { z } from 'zod';

import { authUserSchema, signUpSchema } from './auth';
import { storeSchema } from './stores';

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes('\0'));
const fields = {
  name: text(100),
  description: z
    .string()
    .trim()
    .max(1000)
    .refine((value) => !value.includes('\0')),
  address: text(200),
  deliveryRadiusMeters: z.number().positive(),
  minimumOrderAmount: z.number().int().min(0).max(2147483647),
  isAcceptingOrders: z.boolean(),
  photoUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable(),
};
export const storeCreateSchema = z.strictObject({
  ...fields,
  description: fields.description.default(''),
  isAcceptingOrders: fields.isAcceptingOrders.default(false),
  photoUrl: fields.photoUrl.default(null),
});
export const storeUpdateSchema = z
  .strictObject(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const managedStoreIdSchema = z.strictObject({ storeId: z.uuid() });
export const managedStoresSchema = z.object({ stores: z.array(storeSchema) });
export const managedStoreSchema = z.object({ store: storeSchema });
export const staffCreateSchema = signUpSchema
  .pick({
    name: true,
    email: true,
    password: true,
    phoneNumber: true,
  })
  .extend({ name: text(100) });
export const managedStaffSchema = z.object({ staff: authUserSchema });
