import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { fsModuleCachePath: 'node_modules/.vitest-cache' },
});
