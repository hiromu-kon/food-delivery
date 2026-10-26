# アーキテクチャ

構成と依存の向きを、なぜそうしたかとともにまとめる。作業時のルールは各ディレクトリの `CLAUDE.md` と `.claude/rules/` にある。

## デプロイ単位

`apps/` の 1 ディレクトリを 1 デプロイ単位にする。

| ディレクトリ        | デプロイ先の想定        | 利用者               |
| ------------------- | ----------------------- | -------------------- |
| `apps/api`          | Node.js のサーバー      | すべてのクライアント |
| `apps/web`          | Next.js のサーバー      | 注文者・店舗・運営   |
| `apps/customer-app` | App Store / Google Play | 注文者               |
| `apps/courier-app`  | App Store / Google Play | 配達員               |

- web は注文者・店舗・運営を 1 アプリにまとめ、`(customer)` / `store/` / `admin/` で分ける。画面の部品と API クライアントを共有でき、権限の違いは layout の検査で分けられるため。
- モバイルは注文者と配達員でアプリを分ける。利用者と画面がほとんど重ならず、配達員アプリだけが配達中の位置情報などの権限を必要とするため。

## 業務ロジックの正本

注文・決済・配達状況の判定は `apps/api` だけで行う。web とアプリは API の結果を表示する。

- クライアントが 3 つあるので、判定を画面に書くと同じロジックが 3 か所に分かれ、食い違う。
- Next.js の Route Handler（`apps/web/src/app/api/`）を禁止しているのも同じ理由で、API の置き場所を `apps/api` に一本化するため。

## 型の流れ

```text
packages/db（Drizzle の schema）
  → packages/contract（Zod。API の入出力）
  → apps/api（Hono のルート。AppType を export）
  → hc<AppType>()（web / アプリのクライアント）
```

DB のカラムを変えると、contract・API・クライアントの型が順に変わる。手書きの型を挟むとこの鎖が切れ、型エラーで影響範囲を追えなくなる。

クライアントは `apps/api/src/app-type.ts` を `import type` するだけで、API の実装は実行時に取り込まない。

## 依存の向き

| from                | import してよいもの                                          |
| ------------------- | ------------------------------------------------------------ |
| `apps/api`          | `packages/db` / `packages/domain` / `packages/contract`      |
| web / アプリ        | `packages/domain` / `packages/contract`、`AppType`（型のみ） |
| `packages/contract` | `packages/domain`                                            |
| `packages/domain`   | 他の packages / apps は不可。DB・HTTP・UI のライブラリも不可 |
| `packages/db`       | 他の packages / apps は不可                                  |

- `packages/domain` を純粋に保つのは、web / アプリからも表示用の計算に使えるようにするため。DB や Hono に依存すると、クライアントのバンドルに入れられなくなる。
- web / アプリから `packages/db` を import できないようにして、クライアントが DB に直接触る経路をなくしている。

検査は `.dependency-cruiser.cjs`（ルールごとの理由は各ルールの `comment`）。依存を `package.json` に宣言していない import は、pnpm の構成上解決できないため typecheck で止まる。

## ディレクトリ名

`utils` / `helpers` / `common` / `shared` / `misc` は使わない。何であるかを言わない名前だと置き場所が一つに決まらず、何でも入る箱になるため。`scripts/check-structure.sh` で検査している。

## 画面の部品

| 対象                       | 使うもの                                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| Web（注文者・店舗・運営）  | shadcn/ui。表は shadcn の Data Table（TanStack Table）、フォームは Zod |
| 注文者アプリ・配達員アプリ | React Native Reusables（shadcn/ui の React Native 版）と Uniwind       |

- 部品のコードをリポジトリに取り込む方式なので、`docs/design/` のトークンとコンポーネントに合わせて見た目を変えられる。Web とアプリで部品の名前と考え方をそろえられる。
- 色や余白は Tailwind のテーマにトークンとして定義し、shadcn の色の変数（`--primary` など）に割り当てる。トークンは `packages/design-tokens/theme.css` の 1 つを Web とアプリで共有する。
- アプリの Tailwind には NativeWind ではなく Uniwind を使う。NativeWind の安定版（v4）は Tailwind v3 で、Tailwind v4 に対応した v5 はまだリリース候補のため。Web と同じ Tailwind v4 にそろえないと、トークンを 1 つのファイルで共有できない。
- Refine や react-admin のような管理画面のフレームワークは使わない。データの取得を独自の仕組みで行うため、`hc<AppType>()` で API の型を画面まで通す設計と二重になる。管理画面は店舗 6 枚・運営 7 枚で、表とフォームの部品で足りる。
