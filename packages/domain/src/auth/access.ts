import { DomainError } from '../errors';

export const accountRoles = ['customer', 'store', 'courier', 'admin'] as const;
export type AccountRole = (typeof accountRoles)[number];
export const legalDocumentVersions = {
  terms: 'draft-2026-11-01',
  privacy: 'draft-2026-11-01',
} as const;

export function assertAccountAccess(
  user: { role: AccountRole; disabled: boolean; emailVerified: boolean },
  allowedRoles: readonly AccountRole[],
  requireVerifiedEmail = false,
) {
  if (user.disabled) throw new DomainError('ACCOUNT_DISABLED', 'このアカウントは利用できません');
  if (!allowedRoles.includes(user.role)) throw new DomainError('FORBIDDEN', 'この操作はできません');
  if (requireVerifiedEmail && !user.emailVerified)
    throw new DomainError('EMAIL_NOT_VERIFIED', 'メールアドレスを確認してください');
}
