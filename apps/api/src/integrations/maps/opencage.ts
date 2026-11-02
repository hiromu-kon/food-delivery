import { z } from 'zod';

import { GeocodingError, type Geocoder } from './geocoder';

const responseSchema = z.object({
  status: z.object({ code: z.number().int() }),
  results: z.array(
    z.object({
      geometry: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
      components: z.object({ _type: z.string(), country_code: z.string() }),
    }),
  ),
});

export function createOpenCageGeocoder(
  options: {
    apiKey?: string | undefined;
    timeoutMs?: number;
    fetch?: typeof fetch;
  } = {},
): Geocoder {
  const request = options.fetch ?? fetch;
  return {
    async geocode(address) {
      if (!options.apiKey?.trim()) throw new GeocodingError('GEOCODING_NOT_CONFIGURED');
      const url = new URL('https://api.opencagedata.com/geocode/v1/json');
      url.search = new URLSearchParams({
        key: options.apiKey,
        q: address,
        countrycode: 'jp',
        language: 'ja',
        limit: '2',
        no_annotations: '1',
        no_record: '1',
      }).toString();
      try {
        const response = await request(url, {
          signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
          redirect: 'error',
        });
        if (!response.ok) throw new GeocodingError('GEOCODING_UNAVAILABLE');
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.status.code !== 200)
          throw new GeocodingError('GEOCODING_UNAVAILABLE');
        const [result] = parsed.data.results;
        // 市区町村や道路の中心、複数候補をお届け先の座標として採用しない。
        if (
          parsed.data.results.length !== 1 ||
          !result ||
          result.components._type !== 'building' ||
          result.components.country_code !== 'jp'
        )
          throw new GeocodingError('ADDRESS_NOT_FOUND');
        return { latitude: result.geometry.lat, longitude: result.geometry.lng };
      } catch (error) {
        if (error instanceof GeocodingError) throw error;
        // URL に秘密鍵と住所を含むため、外部例外をログや応答に渡さない。
        throw new GeocodingError('GEOCODING_UNAVAILABLE');
      }
    },
  };
}
