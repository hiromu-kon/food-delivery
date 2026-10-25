# packages/db

- テーブルを足す・変えるときは `src/schema/<feature>.ts` を作り、`src/schema/index.ts` で再 export する。
- `pnpm --filter @repo/db db:generate` でマイグレーションを生成し、`migrations/` をコミットする。
- カラム名は TypeScript 側で camelCase に書く（`casing: 'snake_case'` で DB では snake_case になる）。
