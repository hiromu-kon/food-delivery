import { defineConfig } from 'eslint/config';

// web / customer-app / courier-app 共通。API は src/api/ の hc<AppType>() を通し、レスポンスの型を AppType から得る。
export default defineConfig([
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'src/api/ の apiClient（hc<AppType>()）を使ってください。' },
      ],
    },
  },
]);
