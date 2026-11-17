import { createPostgresDeliveryPhotoStorage } from './integrations/delivery-photos/postgres';
import { serve } from '@hono/node-server';

import { getConnInfo } from '@hono/node-server/conninfo';
import { createDb } from '@repo/db';
import { createApp } from './app';
import { loadEnv } from './env';
import { createAuthService } from './features/auth/auth.service';
import { startOrderExpiryJob } from './features/order-expiry/order-expiry.job';
import { createOrderExpiryService } from './features/order-expiry/order-expiry.service';
import { createOpenCageGeocoder } from './integrations/maps/opencage';
import { createStripeClient } from './integrations/stripe/stripe';
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
const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
const deliveryPhotos =
  env.DELIVERY_PHOTO_STORAGE === 'postgres' ? createPostgresDeliveryPhotoStorage(db) : undefined;
const app = createApp({
  deliveryPhotos,
  auth,
  stripe,
  db,
  config,
  geocoder: createOpenCageGeocoder({
    apiKey: env.OPENCAGE_API_KEY,
    timeoutMs: env.GEOCODING_TIMEOUT_MS,
  }),
  getClientIp: (c) => getConnInfo(c).remote.address,
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

const expiry = createOrderExpiryService(db, stripe);
startOrderExpiryJob(
  () => expiry.run(),
  () => {
    console.error('注文期限切れ取消の未確認処理があります。次回実行で再照合します');
  },
);

const photoRetention = createPostgresDeliveryPhotoStorage(db);
startOrderExpiryJob(
  async () => {
    await photoRetention.purge(new Date());
    return { failed: 0 };
  },
  () => console.error('置き配写真の期限切れ削除に失敗しました。次回実行で再試行します'),
);
