import type { MenuItem } from '@repo/db';
import { z } from 'zod';

import { menuCategorySchema, menuItemSchema } from './menu';

const integer = z.number().int().min(0).max(2147483647);
const fields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  photoUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable(),
  sortOrder: integer,
};
export const categoryCreateSchema = z.strictObject({
  ...fields,
  description: fields.description.default(''),
  photoUrl: fields.photoUrl.default(null),
  sortOrder: integer.default(0),
});
export const categoryUpdateSchema = z
  .strictObject(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const itemCreateSchema = z.strictObject({
  ...categoryCreateSchema.shape,
  categoryId: z.uuid(),
  price: integer,
  soldout: z.boolean().default(false),
});
export const itemUpdateSchema = z
  .strictObject({
    ...fields,
    categoryId: z.uuid(),
    price: integer,
    soldout: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const soldoutInputSchema = z.strictObject({ soldout: z.boolean() });
export const categoryIdSchema = z.strictObject({ categoryId: z.uuid() });
export const itemIdSchema = z.strictObject({ itemId: z.uuid() });
export const managedItemSchema = menuItemSchema.extend({
  categoryId: z.uuid(),
}) satisfies z.ZodType<
  Pick<
    MenuItem,
    'id' | 'categoryId' | 'name' | 'description' | 'price' | 'photoUrl' | 'soldout' | 'sortOrder'
  >
>;
export const categoryResponseSchema = z.object({ category: menuCategorySchema });
export const itemResponseSchema = z.object({ item: managedItemSchema });
export const managedMenuSchema = z.object({
  categories: z.array(menuCategorySchema.extend({ items: z.array(managedItemSchema) })),
});
