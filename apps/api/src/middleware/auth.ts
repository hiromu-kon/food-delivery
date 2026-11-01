import { authUserSchema, type AuthUser } from '@repo/contract';
import type { Db } from '@repo/db';
import { accountRoles, assertAccountAccess, DomainError, type AccountRole } from '@repo/domain';
import { createMiddleware } from 'hono/factory';

import { createAuthRepository } from '../features/auth/auth.repository';
import type { AuthService } from '../features/auth/auth.service';

export type AuthEnv = {
  Variables: { authUser: AuthUser; requestId: string; clientIp: string | undefined };
};

export function requireSession(auth: AuthService, db: Db, allowedOrigins: readonly string[]) {
  const repository = createAuthRepository(db);
  return createMiddleware<AuthEnv>(async (c, next) => {
    const headers = new Headers(c.req.raw.headers);
    const bearer = /^Bearer /i.test(headers.get('authorization') ?? '');
    // 無効な Bearer を Cookie 認証へフォールバックさせると CSRF の検査を迂回できる
    if (bearer) headers.delete('cookie');
    const result = await auth.api.getSession({ headers, returnHeaders: true });
    const session = result.response;
    for (const cookie of result.headers.getSetCookie())
      c.header('Set-Cookie', cookie, { append: true });
    const authToken = result.headers.get('set-auth-token');
    if (authToken) c.header('set-auth-token', authToken);
    if (!session) throw new DomainError('UNAUTHORIZED', 'ログインしてください');
    const user = await repository.findUser(session.user.id);
    if (!user) throw new DomainError('UNAUTHORIZED', 'ログインしてください');
    assertAccountAccess(user, accountRoles);
    if (
      !bearer &&
      !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) &&
      !allowedOrigins.includes(c.req.header('origin') ?? '')
    )
      throw new DomainError('FORBIDDEN', 'この操作はできません');
    c.set('authUser', authUserSchema.parse(user));
    c.header('Cache-Control', 'no-store');
    await next();
  });
}

export function requireRole(roles: readonly AccountRole[], requireVerifiedEmail = false) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('authUser');
    if (!user) throw new DomainError('UNAUTHORIZED', 'ログインしてください');
    assertAccountAccess({ ...user, disabled: false }, roles, requireVerifiedEmail);
    await next();
  });
}
