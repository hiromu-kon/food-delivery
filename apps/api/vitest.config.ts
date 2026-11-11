import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 認証と住所の結合テストが同じ専用 PostgreSQL を初期化するため直列で実行する。
  test: { fileParallelism: false, fsModuleCachePath: 'node_modules/.vitest-cache' },
});
