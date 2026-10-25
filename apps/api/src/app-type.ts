import type { app } from './app';

// クライアント（web / customer-app / courier-app）はこのファイルだけを型 import する。
export type AppType = typeof app;
