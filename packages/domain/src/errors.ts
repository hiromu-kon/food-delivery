export const domainErrorCodes = [
  'ORDER_NOT_ORDERABLE',
  'ORDER_NOT_CANCELABLE',
  'IDEMPOTENCY_CONFLICT',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'ACCOUNT_DISABLED',
  'EMAIL_NOT_VERIFIED',
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}
