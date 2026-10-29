---
paths:
  - 'apps/web/src/**'
  - 'apps/customer-app/src/**'
  - 'apps/courier-app/src/**'
---

# 画面（web / customer-app / courier-app）

| したいこと                                | 置き場所                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| API を呼ぶ                                | `src/api/client.ts` の `apiClient`                                     |
| 画面のロジック（フック・状態）            | `src/features/<feature>/`                                              |
| 画面をまたいで使うコンポーネント          | `src/components/<役割>/`（`form/` `dialog/` のように何であるかで命名） |
| `docs/design/components.md` の部品（web） | `src/components/ui/`（shadcn の CLI が置く場所）                       |
| 環境変数                                  | `src/env.ts` で Zod により検証して export する                         |

- 金額・送料・状態の判定を画面で行わない。表示用の計算が必要なら `packages/domain` の関数を使う。
- 画面の文言・色・余白・部品は `docs/design/` に従う。色や余白は値を直接書かず、トークンを使う。部品は `docs/design/components.md` にある名前で作る。
