# apps/web

- 注文者 `src/app/(customer)/`・店舗 `src/app/store/`・運営 `src/app/admin/` を 1 アプリで提供する。
- 店舗・運営向けの画面ガードは layout に置き、保護データを取得するページ・処理でも認可を確認する。layout の再利用だけに依存しない。
- Server Component から API を呼ぶときは `src/api/server.ts` の `createServerApiClient()` を使う（cookie を転送するため）。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
