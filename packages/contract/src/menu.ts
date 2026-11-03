import type { MenuCategory, MenuItem } from '@repo/db';
import { z } from 'zod';

import { storeSchema } from './stores';

export const menuParamsSchema = z.strictObject({ storeId: z.uuid() });
export const menuQuerySchema = z.strictObject({});

export const menuItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number().int().nonnegative(),
  photoUrl: z.string().nullable(),
  soldout: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
}) satisfies z.ZodType<
  Pick<MenuItem, 'id' | 'name' | 'description' | 'price' | 'photoUrl' | 'soldout' | 'sortOrder'>
>;

export const menuCategorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  photoUrl: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
}) satisfies z.ZodType<
  Pick<MenuCategory, 'id' | 'name' | 'description' | 'photoUrl' | 'sortOrder'>
>;

export const menuResponseSchema = z.object({
  store: storeSchema,
  categories: z.array(menuCategorySchema.extend({ items: z.array(menuItemSchema) })),
});
export type MenuResponse = z.infer<typeof menuResponseSchema>;
