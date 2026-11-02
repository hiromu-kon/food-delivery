export type Coordinates = Readonly<{ latitude: number; longitude: number }>;

// 球面モデル。PostGIS ST_DistanceSphere の既定半径と同じメートル単位。
const earthRadiusMeters = 6371008;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

function assertCoordinates(point: Coordinates) {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180
  )
    throw new RangeError('緯度経度の範囲が不正です');
}

/** 経緯度（度）間の大円距離をメートルで返す。道路距離・標高は扱わない。 */
export function distanceMeters(from: Coordinates, to: Coordinates): number {
  assertCoordinates(from);
  assertCoordinates(to);
  const a =
    Math.sin(radians(to.latitude - from.latitude) / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  // 浮動小数点誤差で対蹠点の a が1を超える場合を抑える。
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

/** 丸める前のメートル値で境界を含めて比較する。 */
export function isWithinDeliveryRadius(distance: number, radiusMeters: number): boolean {
  if (
    !Number.isFinite(distance) ||
    distance < 0 ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters <= 0
  )
    throw new RangeError('距離と配達半径が不正です');
  return distance <= radiusMeters;
}
