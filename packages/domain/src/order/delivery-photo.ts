export function deliveryPhotoExpiresAt(from: Date) {
  return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
}
