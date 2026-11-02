import { describe, expect, it } from 'vitest';

import { accountRoles, assertAccountAccess } from './access';

describe('assertAccountAccess', () => {
  it.each(accountRoles)('R-14 %s は自分のロールの操作を使える', (role) => {
    expect(() =>
      assertAccountAccess({ role, disabled: false, emailVerified: true }, [role]),
    ).not.toThrow();
  });
  it('R-14 ロールが違えば操作できない', () => {
    expect(() =>
      assertAccountAccess({ role: 'customer', disabled: false, emailVerified: true }, ['admin']),
    ).toThrow('この操作はできません');
  });
  it('R-14 停止されたアカウントは操作できない', () => {
    expect(() =>
      assertAccountAccess({ role: 'admin', disabled: true, emailVerified: true }, ['admin']),
    ).toThrow('このアカウントは利用できません');
  });
  it('R-14 メール未確認では注文できない', () => {
    expect(() =>
      assertAccountAccess(
        { role: 'customer', disabled: false, emailVerified: false },
        ['customer'],
        true,
      ),
    ).toThrow('メールアドレスを確認してください');
  });
});
