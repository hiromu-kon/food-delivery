# apps/api

| したいこと                                  | 置き場所                                                                                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| API を足す                                  | `src/features/<feature>/` に `<feature>.schema.ts` / `.routes.ts` / `.service.ts` / `.repository.ts` / `.test.ts`。`src/app.ts` で `.route()` する |
| リクエスト・レスポンスの Zod                | feature 固有のものは `<feature>.schema.ts`。複数の feature やクライアントと共有するものは `packages/contract`                                      |
| 業務エラーを HTTP ステータスに対応させる    | `src/middleware/error-handler.ts`。エラーコード自体は `packages/domain/src/errors.ts`                                                              |
| 外部サービス（決済・地図・Push など）を呼ぶ | `src/integrations/<サービス名>/`。インターフェースと実装を分ける                                                                                   |
| Hono のミドルウェア                         | `src/middleware/<名前>.ts`                                                                                                                         |
| 環境変数                                    | `src/env.ts` で Zod により検証して export する                                                                                                     |

- `c.json()` のステータスはリテラルで書く（`c.json(body, 200)`）。省略や変数だとクライアント側でレスポンスの型が分岐しない。
- 金額・日付・状態遷移の計算は service に書かず、`packages/domain` の関数を呼ぶ。
