import type { Db } from '@repo/db';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';

import { createOrderRoutes } from './features/orders/orders.routes';
import { createStripeClient } from './integrations/stripe/stripe';
import type { StripeClient } from './integrations/stripe/client';
import { createStoreAuthRoutes } from './features/store-auth/store-auth.routes';
import { createAddressRoutes } from './features/addresses/addresses.routes';
import { createStoreRoutes } from './features/stores/stores.routes';
import { createOpenCageGeocoder } from './integrations/maps/opencage';
import type { Geocoder } from './integrations/maps/geocoder';
import { healthRoutes } from './features/health/health.routes';
import { createAuthRoutes } from './features/auth/auth.routes';
import type { AuthConfig, AuthService } from './features/auth/auth.service';
import type { AuthEnv } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

export function createApp(options: {
  auth: AuthService;
  stripe?: StripeClient;
  geocoder?: Geocoder;
  db: Db;
  config: AuthConfig;
  getClientIp: (c: Context<AuthEnv>) => string | undefined;
}) {
  return new Hono<AuthEnv>()
    .use(requestId({ limitLength: 0 }))
    .use(
      cors({
        origin: options.config.webURL,
        credentials: true,
        allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        exposeHeaders: ['set-auth-token', 'x-request-id', 'retry-after'],
      }),
    )
    .use(
      bodyLimit({
        maxSize: 16 * 1024,
        onError: (c) => c.json({ code: 'PAYLOAD_TOO_LARGE', message: '入力が長すぎます' }, 413),
      }),
    )
    .use(async (c, next) => {
      c.set('clientIp', options.getClientIp(c));
      await next();
    })
    .onError(errorHandler)
    .notFound((c) => c.json({ code: 'NOT_FOUND', message: '見つかりません' }, 404))
    .route(
      '/orders',
      createOrderRoutes(
        options.auth,
        options.db,
        options.config,
        options.stripe ?? createStripeClient(),
      ),
    )
    .route('/health', healthRoutes)
    .route('/stores', createStoreRoutes(options.auth, options.db, options.config))
    .route(
      '/store',
      createStoreAuthRoutes(
        options.auth,
        options.db,
        options.config,
        options.stripe ?? createStripeClient(),
      ),
    )
    .route('/auth', createAuthRoutes(options.auth, options.db, options.config))
    .route(
      '/addresses',
      createAddressRoutes(
        options.auth,
        options.db,
        options.config,
        options.geocoder ?? createOpenCageGeocoder(),
      ),
    );
}
