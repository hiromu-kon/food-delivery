import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: {
    fsModuleCachePath: 'node_modules/.vitest-cache',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    env: {
      EXPO_PUBLIC_API_URL: 'http://api.example.test',
      EXPO_PUBLIC_WEB_URL: 'http://web.example.test',
    },
  },
});
