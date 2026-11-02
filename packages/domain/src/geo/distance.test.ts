import { describe, expect, it } from 'vitest';

import { distanceMeters, isWithinDeliveryRadius } from './distance';

const origin = { latitude: 0, longitude: 0 };

describe('配達エリアの距離判定', () => {
  it('R-01 同一地点は0メートルで配達圏内', () => {
    expect(distanceMeters(origin, origin)).toBe(0);
    expect(isWithinDeliveryRadius(0, 3000)).toBe(true);
  });
  it('R-01 度をラジアンに変換し距離をkmでなくメートルで返す', () => {
    expect(distanceMeters(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(111195.066, 3);
    const tokyo = { latitude: 35, longitude: 139 };
    const nearby = { latitude: 35.01, longitude: 139.01 };
    expect(distanceMeters(tokyo, nearby)).toBeCloseTo(1437.357, 2);
    expect(distanceMeters(tokyo, nearby)).toBe(distanceMeters(nearby, tokyo));
  });
  it('R-01 半径以内は含め外側は丸めず除外する', () => {
    expect(isWithinDeliveryRadius(2999.999, 3000)).toBe(true);
    expect(isWithinDeliveryRadius(3000, 3000)).toBe(true);
    expect(isWithinDeliveryRadius(3000.001, 3000)).toBe(false);
    const distance = distanceMeters(origin, { latitude: 0.01, longitude: 0 });
    expect(isWithinDeliveryRadius(distance, distance)).toBe(true);
    expect(isWithinDeliveryRadius(distance, distance - 0.000001)).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity, 91, -91])('R-01 不正な緯度%sを両端で拒否する', (latitude) => {
    expect(() => distanceMeters({ latitude, longitude: 0 }, origin)).toThrow(RangeError);
    expect(() => distanceMeters(origin, { latitude, longitude: 0 })).toThrow(RangeError);
  });
  it.each([NaN, Infinity, -Infinity, 181, -181])('R-01 不正な経度%sを拒否する', (longitude) => {
    expect(() => distanceMeters(origin, { latitude: 0, longitude })).toThrow(RangeError);
  });
  it.each([NaN, Infinity, -Infinity, -1])('R-01 不正な距離%sを拒否する', (distance) => {
    expect(() => isWithinDeliveryRadius(distance, 3000)).toThrow(RangeError);
  });
  it.each([NaN, Infinity, -Infinity, -1, 0])('R-01 不正な半径%sを拒否する', (radius) => {
    expect(() => isWithinDeliveryRadius(0, radius)).toThrow(RangeError);
  });
  it('R-01 日付変更線・対蹠点・極でも有限の距離を返す', () => {
    expect(
      distanceMeters({ latitude: 0, longitude: 179.99 }, { latitude: 0, longitude: -179.99 }),
    ).toBeCloseTo(2223.901, 2);
    expect(distanceMeters(origin, { latitude: 0, longitude: 180 })).toBeCloseTo(Math.PI * 6371008);
    expect(
      Number.isFinite(
        distanceMeters({ latitude: 90, longitude: 180 }, { latitude: -90, longitude: -180 }),
      ),
    ).toBe(true);
  });
});
