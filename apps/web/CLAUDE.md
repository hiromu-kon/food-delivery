@AGENTS.md

# apps/web

- 注文者 `src/app/(customer)/`・店舗 `src/app/store/`・運営 `src/app/admin/` を 1 アプリで提供する。
- 店舗・運営向けの認証・権限の検査は各 layout に置き、ページには書かない。
- Server Component から API を呼ぶときは `src/api/server.ts` の `createServerApiClient()` を使う（cookie を転送するため）。
