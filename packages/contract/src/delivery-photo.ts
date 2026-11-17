import type { DeliveryPhoto } from '@repo/db';
import { z } from 'zod';

export const deliveryPhotoMaxBytes = 2 * 1024 * 1024;
export const deliveryPhotoUploadSchema = z.strictObject({
  mimeType: z.literal('image/jpeg'),
  base64: z
    .string()
    .min(4)
    .max(4 * Math.ceil(deliveryPhotoMaxBytes / 3))
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}) satisfies z.ZodType<Pick<DeliveryPhoto, 'base64'> & { mimeType: 'image/jpeg' }>;
export type DeliveryPhotoUpload = z.infer<typeof deliveryPhotoUploadSchema>;
