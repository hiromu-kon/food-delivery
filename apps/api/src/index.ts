import { serve } from '@hono/node-server';

import { getConnInfo } from '@hono/node-server/conninfo';
import { createDb } from '@repo/db';
import { createApp } from './app';
import { loadEnv } from './env';
import { createAuthService } from './features/auth/auth.service';
import { createSmtpSender } from './integrations/email/smtp';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const config = {
  baseURL: env.AUTH_URL,
  webURL: env.WEB_URL,
  secret: env.AUTH_SECRET,
  secureCookies: env.NODE_ENV === 'production',
  cookieDomain: env.AUTH_COOKIE_DOMAIN,
};
const email = createSmtpSender({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  requireTLS: env.NODE_ENV === 'production',
  from: env.SMTP_FROM,
  user: env.SMTP_USER,
  password: env.SMTP_PASSWORD,
});
const auth = createAuthService(db, email, config);
const app = createApp({ auth, db, config, getClientIp: (c) => getConnInfo(c).remote.address });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
