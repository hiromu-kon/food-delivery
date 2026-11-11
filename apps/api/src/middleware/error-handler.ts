import type { ApiError } from '@repo/contract';
import { DomainError, type DomainErrorCode } from '@repo/domain';
import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';

import { PaymentError } from '../integrations/stripe/client';
import { GeocodingError } from '../integrations/maps/geocoder';

const statusByDomainErrorCode = {
  ORDER_NOT_ORDERABLE: 422,
  ORDER_NOT_CANCELABLE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  EMAIL_NOT_VERIFIED: 403,
} as const satisfies Record<DomainErrorCode, ContentfulStatusCode>;

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof PaymentError)
    return c.json(
      { code: error.code, message: '決済を完了できませんでした' },
      error.code === 'PAYMENT_FAILED' ? 402 : 503,
    );
  if (error instanceof GeocodingError) {
    if (error.code === 'ADDRESS_NOT_FOUND')
      return c.json(
        { code: error.code, message: '住所を特定できません。番地まで確認してください' },
        422,
      );
    if (error.code === 'GEOCODING_NOT_CONFIGURED')
      return c.json({ code: error.code, message: '地図サービスが設定されていません' }, 503);
    return c.json(
      { code: error.code, message: '住所を確認できませんでした。時間をおいてお試しください' },
      503,
    );
  }
  if (error instanceof DomainError) {
    const body: ApiError = { code: error.code, message: error.message };
    return c.json(body, statusByDomainErrorCode[error.code]);
  }
  if (error instanceof HTTPException && error.status === 400)
    return c.json({ code: 'INVALID_REQUEST', message: '入力内容を確認してください' }, 400);
  console.error({ event: 'unhandled_error', requestId: c.get('requestId') });
  const body: ApiError = { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' };
  return c.json(body, 500);
};
