import { deliveryPhotoMaxBytes, type DeliveryPhotoUpload } from '@repo/contract';
import { DomainError } from '@repo/domain';
import sharp from 'sharp';

export async function normalizeDeliveryPhoto(photo: DeliveryPhotoUpload) {
  const bytes = Buffer.from(photo.base64, 'base64');
  try {
    if (bytes.length > deliveryPhotoMaxBytes || bytes.toString('base64') !== photo.base64)
      throw new Error('Invalid size or encoding');
    const image = sharp(bytes, { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    if (metadata.format !== 'jpeg') throw new Error('Invalid format');
    const normalized = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    if (normalized.length > deliveryPhotoMaxBytes) throw new Error('Invalid size');
    return normalized.toString('base64');
  } catch {
    throw new DomainError('DELIVERY_PHOTO_INVALID', '2MB以内のJPEG写真を撮り直してください');
  }
}
