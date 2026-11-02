import { legalDocumentVersions } from '@repo/domain';
import type { Db } from '@repo/db';
import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import { requireSession, type AuthEnv } from '../../middleware/auth';
import {
  authUserSchema,
  emailSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verificationQuerySchema,
} from './auth.schema';
import type { AuthConfig, AuthService } from './auth.service';

const validationFailure = (result: { success: boolean }, c: Context) => {
  if (!result.success)
    return c.json({ code: 'VALIDATION_ERROR', message: '入力内容を確認してください' }, 400);
};

function copyAuthHeaders(c: Context<AuthEnv>, response: Response) {
  for (const cookie of response.headers.getSetCookie())
    c.header('Set-Cookie', cookie, { append: true });
  for (const name of ['set-auth-token', 'retry-after']) {
    const value = response.headers.get(name);
    if (value) c.header(name, value);
  }
  const retryAfter = response.headers.get('retry-after') ?? response.headers.get('x-retry-after');
  if (retryAfter) c.header('Retry-After', retryAfter);
  c.header('Cache-Control', 'no-store');
}

async function authFailure(c: Context<AuthEnv>, response: Response) {
  copyAuthHeaders(c, response);
  const parsed = z.object({ code: z.string() }).safeParse(await response.json().catch(() => null));
  const code = parsed.success ? parsed.data.code : '';
  if (response.status === 429)
    return c.json(
      { code: 'RATE_LIMITED', message: 'しばらく待ってから、もう一度お試しください' },
      429,
    );
  if (code === 'EMAIL_NOT_VERIFIED')
    return c.json({ code, message: 'メールアドレスを確認してください' }, 403);
  if (code === 'ACCOUNT_DISABLED')
    return c.json({ code, message: 'このアカウントは利用できません' }, 403);
  if (['INVALID_TOKEN', 'TOKEN_EXPIRED'].includes(code))
    return c.json(
      { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'リンクの有効期限を確認してください' },
      400,
    );
  if (response.status === 401)
    return c.json(
      { code: 'INVALID_CREDENTIALS', message: 'メールアドレスまたはパスワードを確認してください' },
      401,
    );
  if (response.status === 403)
    return c.json({ code: 'FORBIDDEN', message: 'この操作はできません' }, 403);
  if (response.status >= 500)
    return c.json(
      { code: 'INTERNAL_SERVER_ERROR', message: '処理できませんでした。もう一度お試しください' },
      500,
    );
  return c.json(
    { code: 'INVALID_REQUEST', message: '入力内容またはリンクの有効期限を確認してください' },
    400,
  );
}

export function createAuthRoutes(auth: AuthService, db: Db, config: AuthConfig) {
  async function forward(c: Context<AuthEnv>, path: string, body?: unknown) {
    const headers = new Headers(c.req.raw.headers);
    // 接続元は Node サーバーから受け取る。クライアントが送った転送ヘッダーは信用しない
    headers.delete('x-auth-client-ip');
    headers.delete('content-length');
    if (body !== undefined) headers.set('content-type', 'application/json');
    const ip = c.get('clientIp');
    if (ip) headers.set('x-auth-client-ip', ip);
    if (/^Bearer /i.test(headers.get('authorization') ?? '')) headers.delete('cookie');
    const url = new URL(`/auth${path}`, config.baseURL);
    return auth.handler(
      new Request(url, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      }),
    );
  }

  return new Hono<AuthEnv>()
    .use(async (c, next) => {
      c.header('Cache-Control', 'no-store');
      await next();
    })
    .get('/policies', (c) => c.json(legalDocumentVersions, 200))
    .post('/sign-up/email', zValidator('json', signUpSchema, validationFailure), async (c) => {
      const { name, email, password, phoneNumber } = c.req.valid('json');
      const response = await forward(c, '/sign-up/email', { name, email, password, phoneNumber });
      if (!response.ok) return authFailure(c, response);
      copyAuthHeaders(c, response);
      return c.json({ status: true } as const, 200);
    })
    .post('/sign-in/email', zValidator('json', signInSchema, validationFailure), async (c) => {
      const response = await forward(c, '/sign-in/email', c.req.valid('json'));
      if (!response.ok) return authFailure(c, response);
      copyAuthHeaders(c, response);
      const result = z.object({ user: authUserSchema }).parse(await response.json());
      return c.json(result, 200);
    })
    .post('/sign-out', async (c) => {
      const response = await forward(c, '/sign-out', {});
      if (!response.ok) return authFailure(c, response);
      copyAuthHeaders(c, response);
      return c.json({ status: true } as const, 200);
    })
    .post(
      '/send-verification-email',
      zValidator('json', emailSchema, validationFailure),
      async (c) => {
        const response = await forward(c, '/send-verification-email', c.req.valid('json'));
        if (!response.ok) return authFailure(c, response);
        return c.json({ status: true } as const, 200);
      },
    )
    .get(
      '/verify-email',
      zValidator('query', verificationQuerySchema, validationFailure),
      async (c) => {
        const response = await forward(
          c,
          `/verify-email?${new URLSearchParams(c.req.valid('query')).toString()}`,
        );
        if (!response.ok) return authFailure(c, response);
        return c.redirect(new URL('/login?verified=true', config.webURL).href, 302);
      },
    )
    .post(
      '/request-password-reset',
      zValidator('json', emailSchema, validationFailure),
      async (c) => {
        const response = await forward(c, '/request-password-reset', c.req.valid('json'));
        if (!response.ok) return authFailure(c, response);
        return c.json({ status: true } as const, 200);
      },
    )
    .post(
      '/reset-password',
      zValidator('json', resetPasswordSchema, validationFailure),
      async (c) => {
        const response = await forward(c, '/reset-password', c.req.valid('json'));
        if (!response.ok) return authFailure(c, response);
        copyAuthHeaders(c, response);
        return c.json({ status: true } as const, 200);
      },
    )
    .get('/me', requireSession(auth, db, [config.webURL, new URL(config.baseURL).origin]), (c) =>
      c.json({ user: c.get('authUser') }, 200),
    );
}
