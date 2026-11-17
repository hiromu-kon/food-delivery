import { describe, expect, it } from 'vitest';
import { deliveryPhotoExpiresAt } from './delivery-photo';

describe('置き配写真の保存期間', () => {
  it('R-15 月・年をまたいでも配達完了から正確に30日後に期限を迎える', () => {
    expect(deliveryPhotoExpiresAt(new Date('2026-12-15T12:34:56Z')).toISOString()).toBe(
      '2027-01-14T12:34:56.000Z',
    );
  });
});
