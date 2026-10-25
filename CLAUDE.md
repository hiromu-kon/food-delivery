# CLAUDE.md

フードデリバリーサービスのモノレポ。pnpm workspaces + Turborepo。

## 構成

`apps/` の 1 ディレクトリ = 1 デプロイ単位。

| ディレクトリ        | 役割                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| `apps/api`          | Hono。業務ロジックの正本。`src/app-type.ts` で `AppType` を export する            |
| `apps/web`          | Next.js。注文者 `(customer)` / 店舗 `store/` / 運営 `admin/` を 1 アプリで提供する |
| `apps/customer-app` | Expo（Expo Router）。注文者向けアプリ                                              |
| `apps/courier-app`  | Expo（Expo Router）。配達員向けアプリ                                              |
| `packages/db`       | Drizzle の schema と migrations。テーブル定義の唯一の正本                          |
| `packages/domain`   | 純粋な業務ロジック（金額・日付・状態遷移）。DB・HTTP・UI に依存しない              |
| `packages/contract` | Zod スキーマ。API の入出力の正本                                                   |
| `packages/config`   | tsconfig / ESLint の共通設定                                                       |

`apps/web` を触るときは `apps/web/AGENTS.md` も読む（Next.js 16 の API は学習データと違う）。

## 原則

- 注文・決済・配達状況の正本は `apps/api`。web / アプリは API の結果を表示するだけで、金額や状態の判定をしない。
- 型は `packages/db` → `packages/contract` → `apps/api`（`AppType`）→ `hc<AppType>()` の順に導出する。手書きで重複させない。
- `packages/domain` の関数は時刻・乱数を引数で受け取る。`Date.now()` / `new Date()` を直接呼ばない（テストで時刻を固定できなくなる）。
- `eslint-disable` 系のコメントは効かない（`noInlineConfig`）。例外は `packages/config/eslint/` に `files` 指定で理由とともに登録する。

## どこに置くか

| したいこと                                  | 置き場所                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API を足す                                  | `apps/api/src/features/<feature>/` に `<feature>.schema.ts` / `.routes.ts` / `.service.ts` / `.repository.ts` / `.test.ts`。`src/app.ts` で `.route()` する |
| テーブルを足す・変える                      | `packages/db/src/schema/<feature>.ts` を作り `schema/index.ts` で再 export。`pnpm --filter @repo/db db:generate` でマイグレーションを生成してコミットする   |
| 金額・日付・状態遷移の計算                  | `packages/domain/src/<領域>/` に純関数として                                                                                                                |
| 業務エラー                                  | `packages/domain/src/errors.ts` の `DomainError`。HTTP ステータスとの対応は `apps/api/src/middleware/error-handler.ts`                                      |
| API の入出力の型                            | `packages/contract/src/` の Zod                                                                                                                             |
| 外部サービス（決済・地図・Push など）を呼ぶ | `apps/api/src/integrations/<サービス名>/`。インターフェースと実装を分ける                                                                                   |
| Hono のミドルウェア                         | `apps/api/src/middleware/<名前>.ts`                                                                                                                         |
| 画面から API を呼ぶ                         | `src/api/client.ts` の `apiClient`。Next.js の Server Component からは `src/api/server.ts`                                                                  |
| 画面のロジック（フック・状態）              | `src/features/<feature>/`                                                                                                                                   |
| 画面をまたいで使うコンポーネント            | `src/components/<役割>/`（`form/` `dialog/` のように何であるかで命名）                                                                                      |
| 店舗・運営向けのページ                      | `apps/web/src/app/store/`・`apps/web/src/app/admin/` 配下。認証・権限の検査は layout に置き、ページには書かない                                             |
| 環境変数                                    | 各 app の `src/env.ts` で Zod により検証して export する                                                                                                    |

## 禁止（機械で検査している）

| 禁止すること                                                                   | 検査                              |
| ------------------------------------------------------------------------------ | --------------------------------- |
| `utils` / `helpers` / `common` / `shared` / `misc` という名前のディレクトリ    | `scripts/check-structure.sh`      |
| Next.js の Route Handler（`apps/web/src/app/api/`）                            | `scripts/check-structure.sh`      |
| web / アプリから `packages/db` を import する                                  | dependency-cruiser                |
| `packages/domain` から DB・Hono・React・他の packages を import する           | dependency-cruiser                |
| `apps/*` 同士の import（`apps/api/src/app-type.ts` の `import type` だけ例外） | dependency-cruiser                |
| 画面から `fetch` を直接呼ぶ（`src/api/` 以外）                                 | ESLint（`no-restricted-globals`） |

## 命名

- API・パッケージのファイル: `<feature>.<role>.ts`（例: `orders.service.ts`）
- テスト: 実装と同じディレクトリに `<name>.test.ts`
- `c.json()` のステータスはリテラルで書く（`c.json(body, 200)`）。省略や変数だとクライアント側でレスポンスの型が分岐しない

## コマンド

| コマンド               | 内容                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `pnpm install`         | 依存のインストール                                         |
| `docker compose up -d` | ローカルの PostgreSQL を起動                               |
| `pnpm dev`             | 全 app を起動（個別は `pnpm --filter @repo/api dev` など） |
| `pnpm check`           | 構成の検査 + dependency-cruiser + typecheck + lint + test  |
| `pnpm format`          | Prettier で整形                                            |

## 確認手順

- 変更後は `pnpm check` と `pnpm format:check` が通ること。
- 依存を足すときは `pnpm-workspace.yaml` の `catalog` にバージョンを書き、各 `package.json` では `"catalog:"` で参照する。
- Expo の SDK を上げるときは `pnpm --filter @repo/customer-app exec expo install --fix` の結果を catalog に反映し、両アプリで `npx expo-doctor` を通す。
