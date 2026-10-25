import next from '@repo/config/eslint/next';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...next,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
]);
