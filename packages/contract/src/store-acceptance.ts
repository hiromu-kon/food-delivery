import type { Store } from '@repo/db';
import { z } from 'zod';

export const storeAcceptanceInputSchema = z.strictObject({
  isAcceptingOrders: z.boolean(),
}) satisfies z.ZodType<Pick<Store, 'isAcceptingOrders'>>;

export const storeAcceptanceResponseSchema = z.object({
  store: storeAcceptanceInputSchema.extend({ id: z.uuid() }),
});
export type StoreAcceptanceInput = z.infer<typeof storeAcceptanceInputSchema>;
