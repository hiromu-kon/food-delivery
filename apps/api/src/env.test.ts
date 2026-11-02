import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://localhost/food_delivery_test',
  AUTH_SECRET: 'test-secret-for-validation-not-for-production-123',
};

describe('loadEnv', () => {
  it('false の SMTP 設定を true に変換しない', () => {
    expect(loadEnv({ ...base, SMTP_SECURE: 'false' }).SMTP_SECURE).toBe(false);
  });
  it('本番では HTTPS と本番用の秘密鍵が必要になる', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        AUTH_URL: 'https://api.example.test',
        WEB_URL: 'https://web.example.test',
        AUTH_COOKIE_DOMAIN: 'example.test',
        AUTH_SECRET: 'development-only-secret-change-before-deploy',
      }),
    ).toThrow();
    expect(
      loadEnv({
        ...base,
        NODE_ENV: 'production',
        AUTH_URL: 'https://api.example.test',
        WEB_URL: 'https://web.example.test',
        AUTH_COOKIE_DOMAIN: 'example.test',
      }).NODE_ENV,
    ).toBe('production');
  });
  it('Cookie を共有する場合は Web と API の共通ドメインだけを許可する', () => {
    const splitHosts = {
      ...base,
      AUTH_URL: 'https://api.example.test',
      WEB_URL: 'https://web.example.test',
    };
    expect(() => loadEnv(splitHosts)).toThrow();
    expect(() => loadEnv({ ...splitHosts, AUTH_COOKIE_DOMAIN: 'other.test' })).toThrow();
    expect(() => loadEnv({ ...splitHosts, AUTH_COOKIE_DOMAIN: 'test; Secure' })).toThrow();
    expect(loadEnv({ ...splitHosts, AUTH_COOKIE_DOMAIN: 'example.test' }).AUTH_COOKIE_DOMAIN).toBe(
      'example.test',
    );
  });
  it('SMTP のユーザー名とパスワードは両方設定する', () => {
    expect(() => loadEnv({ ...base, SMTP_USER: 'example-user' })).toThrow();
  });
});
