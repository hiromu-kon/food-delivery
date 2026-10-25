# food-delivery

フードデリバリーサービスのモノレポ。

| ディレクトリ        | 技術                 | 対象                          |
| ------------------- | -------------------- | ----------------------------- |
| `apps/api`          | Hono（Node.js）      | API                           |
| `apps/web`          | Next.js              | 注文者・店舗・運営向けの Web  |
| `apps/customer-app` | React Native（Expo） | 注文者向けアプリ              |
| `apps/courier-app`  | React Native（Expo） | 配達員向けアプリ              |
| `packages/db`       | Drizzle ORM          | DB スキーマ・マイグレーション |
| `packages/domain`   | TypeScript           | 業務ロジック（純関数）        |
| `packages/contract` | Zod                  | API の入出力スキーマ          |
| `packages/config`   | —                    | tsconfig / ESLint の共通設定  |

要件定義は [docs/requirements/](docs/requirements/overview.md)、仕様は [docs/specs/](docs/specs/README.md)、設計の理由は [docs/architecture.md](docs/architecture.md)、何をどこに置くかは各ディレクトリの `CLAUDE.md` と `.claude/rules/` にまとめている。

```text
food-delivery/
├─ apps/
│  ├─ api/
│  │  └─ src/
│  │     ├─ features/<feature>/   schema / routes / service / repository / test
│  │     ├─ middleware/
│  │     ├─ integrations/         外部サービスのアダプタ
│  │     ├─ app.ts                features を合成
│  │     ├─ app-type.ts           export type AppType（クライアントはここだけを型 import）
│  │     └─ index.ts              サーバー起動
│  ├─ web/
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ (customer)/        注文者向け（/）
│  │     │  ├─ store/             店舗向け（/store）
│  │     │  └─ admin/             運営向け（/admin）
│  │     ├─ api/                  hc<AppType>() のクライアント
│  │     ├─ components/
│  │     └─ features/
│  ├─ customer-app/
│  │  └─ src/
│  │     ├─ app/                  Expo Router
│  │     ├─ api/
│  │     ├─ components/
│  │     └─ features/
│  └─ courier-app/                customer-app と同じ構成
├─ packages/
│  ├─ db/
│  ├─ domain/
│  ├─ contract/
│  └─ config/
├─ scripts/                       構成・依存の検査
├─ compose.yaml                   ローカルの PostgreSQL
├─ pnpm-workspace.yaml            ワークスペースと依存バージョン（catalog）
└─ turbo.json
```

## 必要なもの

- Node.js 24 以上
- pnpm 10（`corepack enable` で `package.json` の `packageManager` のバージョンが使われる）
- Docker（ローカルの PostgreSQL）
- モバイル: Xcode（iOS シミュレータ）または Android Studio（Android エミュレータ）

## セットアップ

```sh
pnpm install
docker compose up -d

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/customer-app/.env.example apps/customer-app/.env
cp apps/courier-app/.env.example apps/courier-app/.env
cp packages/db/.env.example packages/db/.env
```

## 開発

```sh
pnpm dev                                  # 全 app を起動
pnpm --filter @repo/api dev               # API（http://localhost:8787）
pnpm --filter @repo/web dev               # Web（http://localhost:3000）
pnpm --filter @repo/customer-app dev      # 注文者アプリ（Expo）
pnpm --filter @repo/courier-app dev       # 配達員アプリ（Expo、Metro は 8082）
```

## 確認

```sh
pnpm check          # 構成の検査 + dependency-cruiser + typecheck + lint + test
pnpm format:check
```
