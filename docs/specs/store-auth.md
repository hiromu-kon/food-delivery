# 店舗スタッフ認証

F-09 / Issue44。運営が発行した店舗スタッフは既存の Better Auth のメール・パスワード認証を使う。ログイン・ログアウト・セッション更新・確認メール・再設定は [認証](auth.md) の共通 API と保護を再利用する。公開登録は customer のみ。運営による発行 F-17、店舗 CRUD、注文業務、公開スタッフ登録・所属変更 API はこの機能に含めない。

## データと所属

`store_staff_memberships` は `user_id`（users への FK）を主キー、`store_id`（stores への FK）を必須とする。1 user は最大 1 store、1 store は複数スタッフを持てる。両 FK は削除時 cascade。未所属のアカウントは存在できるが店舗業務にはアクセスできない。所属と role は別の条件であり、所属があっても role が store 以外なら許可しない。

Better Auth の `accounts` は認証プロバイダの資格情報を保持し、1 user に複数の資格情報を持てる。そのため storeId を直接追加せず、所属を専用テーブルに分ける。既存 users/accounts の構造・公開登録・customer 認証は変更しない。

## API と公開情報

`GET /store/me` は Cookie または署名付き Bearer で認証する。成功は 200、`Cache-Control: no-store`。`storeMeResponseSchema` / `StoreContext` を `@repo/contract` から共有し、`AppType` を通じて RPC の応答型を導出する。

```json
{
  "user": {
    "id": "staff-id",
    "name": "架空スタッフ",
    "email": "staff@example.test",
    "emailVerified": true,
    "phoneNumber": "09000000000",
    "role": "store"
  },
  "store": {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "架空店舗"
  }
}
```

本人プロフィールと店舗 id/name だけを返す。資格情報、他スタッフ、店舗住所や内部設定は返さない。query は空の strict schema で検証し、storeId/userId などの追加は 400。本文や URL の店舗 ID を所属の判断に使わない。この経路の書込メソッドは未提供。受付切替の書込は [受付の切替](store-acceptance.md) の `PATCH /store/acceptance` を使う。

| 条件                                                                   | 応答                        |
| ---------------------------------------------------------------------- | --------------------------- |
| 未認証・無効な署名・期限切れ・失効・削除済み user                      | 401                         |
| customer/courier/admin・停止・メール未確認・所属なし・所属店舗削除済み | 403                         |
| 不正な query                                                           | 400（認証・認可を先に実施） |

## 再利用する guard

店舗業務ルートは `Hono<StoreEnv>` に `requireSession(auth, db, allowedOrigins)`、続いて `requireStoreContext(db)` を適用する。後者は前者が設定する認証済み本人 ID を使い、users・store_staff_memberships・stores を同じ SELECT で読み、role=store・disabled=false・emailVerified=true と存在する所属店舗を毎回確認する。結果は `c.get('storeContext')` の `user` と `store`。店舗スコープはこの `store.id` からのみ取得する。

セッション発行時の権限・所属のキャッシュを利用しない。所属解除・移動・店舗削除・停止・role/確認状態変更は次のリクエストから既存セッションにも反映する。guard が認可した直後の並行変更までロックするものではない。将来の書込処理では、この本人/店舗条件を更新 SQL の WHERE やトランザクションでも検証して、認可と更新の間の変更に対応する。

Cookie の変更要求には既存 requireSession の Origin 検査を適用する。不正な Bearer がある場合は Cookie にフォールバックしない。ログイン等の rate limit、CORS、署名検証は共通認証に従う。

## Web F-09 / Issue45 の利用

ログインは `POST /auth/sign-in/email`、店舗画面へのアクセス判定は `GET /store/me`。`/auth/me` の role だけで店舗へのアクセスを許可しない。RPC 呼出しは `client.store.me.$get({ query: {} }, { init: { credentials: 'include' } })` を使う。SSR では受信 Cookie を転送する。RSC は Cookie を書けないため、更新は credentials include のブラウザ再確認で受けさせる（詳細は [店舗 Web 認証](store-auth-web.md)）。401 はログインへ、403 はアクセス不可とログアウトの案内へ進める。ネットワークエラーは認証失効と区別し、ページ表示・遷移・復帰時にも再確認する。

専用 PostgreSQL による再現用の架空スタッフ発行手順と API 起動条件は worker の QA report に記録する。公開 seed や発行の仮 API は追加しない。
