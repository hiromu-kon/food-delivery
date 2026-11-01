import type { ApiError } from '@repo/contract';
import { DomainError, type DomainErrorCode } from '@repo/domain';
import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';

const statusByDomainErrorCode = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  EMAIL_NOT_VERIFIED: 403,
} as const satisfies Record<DomainErrorCode, ContentfulStatusCode>;

export const errorHandler: ErrorHandler = (error, c) => {
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
