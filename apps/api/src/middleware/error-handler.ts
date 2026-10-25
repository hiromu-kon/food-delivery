import type { ApiError } from '@repo/contract';
import { DomainError, type DomainErrorCode } from '@repo/domain';
import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

const statusByDomainErrorCode = {
  NOT_FOUND: 404,
} as const satisfies Record<DomainErrorCode, ContentfulStatusCode>;

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof DomainError) {
    const body: ApiError = { code: error.code, message: error.message };
    return c.json(body, statusByDomainErrorCode[error.code]);
  }
  console.error(error);
  const body: ApiError = { code: 'INTERNAL_SERVER_ERROR', message: 'Internal Server Error' };
  return c.json(body, 500);
};
