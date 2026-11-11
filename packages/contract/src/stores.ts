import type { Store } from '@repo/db';
import { z } from 'zod';

export const storeSearchQuerySchema = z.strictObject({ addressId: z.uuid() });

export const storeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  address: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deliveryRadiusMeters: z.number().positive(),
  minimumOrderAmount: z.number().int().nonnegative(),
  isAcceptingOrders: z.boolean(),
  photoUrl: z.string().nullable(),
}) satisfies z.ZodType<
  Pick<
    Store,
    | 'id'
    | 'name'
    | 'description'
    | 'address'
    | 'latitude'
    | 'longitude'
    | 'deliveryRadiusMeters'
    | 'minimumOrderAmount'
    | 'isAcceptingOrders'
    | 'photoUrl'
  >
>;

export const storeSearchResultSchema = storeSchema.extend({
  distanceMeters: z.number().nonnegative(),
  canOrder: z.boolean(),
});
export const storeSearchResponseSchema = z.object({ stores: z.array(storeSearchResultSchema) });
export type StoreSearchResult = z.infer<typeof storeSearchResultSchema>;
export type StoreSearchQuery = z.infer<typeof storeSearchQuerySchema>;
