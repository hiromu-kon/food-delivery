import { accounts, rateLimits, sessions, users, verifications, type Db } from '@repo/db';
import { accountRoles, legalDocumentVersions } from '@repo/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { bearer } from 'better-auth/plugins';

import type { EmailSender } from '../../integrations/email/sender';
import { createAuthRepository } from './auth.repository';

export type AuthConfig = {
  baseURL: string;
  webURL: string;
  secret: string;
  secureCookies: boolean;
};

export function createAuthService(db: Db, email: EmailSender, config: AuthConfig) {
  const repository = createAuthRepository(db);
  return betterAuth({
    appName: 'Food Delivery',
    baseURL: config.baseURL,
    basePath: '/auth',
    secret: config.secret,
    trustedOrigins: [config.webURL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        rateLimit: rateLimits,
      },
      transaction: true,
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      async sendResetPassword({ user, token }) {
        const url = new URL('/reset-password', config.webURL);
        url.searchParams.set('token', token);
        await email.send({
          to: user.email,
          subject: 'パスワードを再設定する',
          text: `30 分以内に次のリンクからパスワードを再設定してください。\n${url.href}\nこの操作に心当たりがなければ、何もする必要はありません。`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      async sendVerificationEmail({ user, token }) {
        const url = new URL('/auth/verify-email', config.baseURL);
        url.searchParams.set('token', token);
        await email.send({
          to: user.email,
          subject: 'メールアドレスを確認する',
          text: `1 時間以内に次のリンクを開いて、メールアドレスを確認してください。\n${url.href}`,
        });
      },
    },
    user: {
      additionalFields: {
        phoneNumber: { type: 'string', required: true },
        role: { type: [...accountRoles], defaultValue: 'customer', input: false },
        disabled: { type: 'boolean', defaultValue: false, input: false, returned: false },
        termsAcceptedAt: { type: 'date', required: false, input: false, returned: false },
        termsVersion: { type: 'string', required: false, input: false, returned: false },
        privacyVersion: { type: 'string', required: false, input: false, returned: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    verification: { storeIdentifier: 'hashed' },
    plugins: [bearer({ requireSignature: true })],
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 5 },
        '/send-verification-email': { window: 60, max: 5 },
      },
    },
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: config.secureCookies },
      ipAddress: { ipAddressHeaders: ['x-auth-client-ip'] },
      backgroundTasks: {
        handler: (task) => {
          void task.catch(() => console.error({ event: 'auth_background_task_failed' }));
        },
      },
    },
    logger: {
      log: (level) => {
        if (level === 'error') console.error({ event: 'auth_error' });
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: (user) =>
            Promise.resolve({
              data: {
                ...user,
                role: 'customer',
                termsAcceptedAt: new Date(),
                termsVersion: legalDocumentVersions.terms,
                privacyVersion: legalDocumentVersions.privacy,
              },
            }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await repository.findUser(session.userId);
            if (!user || user.disabled)
              throw new APIError('FORBIDDEN', {
                code: 'ACCOUNT_DISABLED',
                message: 'このアカウントは利用できません',
              });
          },
        },
      },
    },
  });
}

export type AuthService = ReturnType<typeof createAuthService>;
