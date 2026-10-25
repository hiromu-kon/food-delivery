import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// next.js / react-native.js ではフレームワークの設定より後ろに並べる。先に置くとパーサーやルールを上書きされる。
export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/.expo/**',
    '**/.turbo/**',
    '**/migrations/**',
    '**/next-env.d.ts',
    '**/expo-env.d.ts',
  ]),
  {
    // 無効化コメントを書いても効かないようにする。例外はこの設定ファイル群に files 指定で登録し、差分としてレビューに出す。
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);
