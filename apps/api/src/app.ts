import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { healthRoutes } from './features/health/health.routes';
import { errorHandler } from './middleware/error-handler';

export const app = new Hono().use(requestId()).onError(errorHandler).route('/health', healthRoutes);
