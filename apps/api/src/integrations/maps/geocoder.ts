export type Coordinates = { latitude: number; longitude: number };

export interface Geocoder {
  geocode(address: string): Promise<Coordinates>;
}

export class GeocodingError extends Error {
  constructor(
    public readonly code:
      'ADDRESS_NOT_FOUND' | 'GEOCODING_UNAVAILABLE' | 'GEOCODING_NOT_CONFIGURED',
  ) {
    super(code);
  }
}
