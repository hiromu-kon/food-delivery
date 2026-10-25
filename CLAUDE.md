# CLAUDE.md

フードデリバリーサービスのモノレポ（pnpm workspaces + Turborepo）。`apps/` の 1 ディレクトリ = 1 デプロイ単位。各ディレクトリの役割は `README.md`、設計の理由は `docs/architecture.md`。

## 原則

- 注文・決済・配達状況の正本は `apps/api`。web / アプリは API の結果を表示するだけで、金額や状態の判定をしない。
- 型は `packages/db` → `packages/contract` → `apps/api`（`AppType`）→ `hc<AppType>()` の順に導出する。手書きで重複させない。
- `eslint-disable` 系のコメントは効かない（`noInlineConfig`）。例外は `packages/config/eslint/` に `files` 指定で理由とともに登録する。
- テストは実装と同じディレクトリに `<name>.test.ts` として置く。

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
