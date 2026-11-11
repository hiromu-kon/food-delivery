# 仕様：メニュー取得（F04）

認証済みの有効な注文者が店舗情報とカテゴリごとの商品を取得する。メール確認前でも閲覧できる。既存の店舗UUIDを使用し、店舗検索・住所・認証のAPIは変更しない。

## API

`GET /stores/:storeId/menu`

- `storeId` はUUID。形式不正は400 `VALIDATION_ERROR`、不存在店舗は404 `NOT_FOUND`（「店舗が見つかりません」）。
- queryは使用しない。未知キー、重複キー、空キーを含むすべてのqueryパラメータを400で拒否する。パラメータのない末尾の `?` は許可する。
- 未認証は401、停止アカウント・customer以外のroleは403。入力検証より先に認可する。
- 成功は200 `{ store, categories: [{ ...category, items: [...] }] }`。メニューなしは `categories: []`、空カテゴリは `items: []`。
- 受付停止中の店舗も読める（R-09）。売り切れの商品も除外せず返す（R-10）。店舗受付状態・商品売り切れ状態は毎回DBを参照する。
- 成功・エラーとも `Cache-Control: no-store`。地図APIなどの外部サービスは呼ばない。

店舗スタッフによる受付状態の変更は [受付の切替（F-12）](store-acceptance.md) を参照する。

## 保存・公開項目

`menu_categories` は `id`（UUID）、`storeId`、`name`、`description`（初期値空文字）、`photoUrl`（nullable）、`sortOrder`（非負整数・初期値0）を保存する。

`menu_items` は `id`（UUID）、`storeId`、`categoryId`、`name`、`description`（初期値空文字）、`price`（税込整数円・0以上）、`photoUrl`（nullable）、`soldout`（初期値false）、`sortOrder`（非負整数・初期値0）を保存する。価格・順序はPostgreSQL integer型の範囲内とする（R-02）。両テーブルの名前は1〜100文字、説明は1000文字以内。

公開店舗情報は既存contractの `storeSchema` と同じ（`id`、`name`、`description`、`address`、`latitude`、`longitude`、`deliveryRadiusMeters`、`minimumOrderAmount`、`isAcceptingOrders`、`photoUrl`）。検索用の距離や本人住所は要求せず、`distanceMeters`・`canOrder` は付けない。

カテゴリは `id`、`name`、`description`、`photoUrl`、`sortOrder`、`items` を公開する。商品は `id`、`name`、`description`、`price`、`photoUrl`、`soldout`、`sortOrder` を公開する。DBの所有店舗ID・カテゴリ参照ID、利用者・住所・セッション情報は返さない。DBの保存型からcontractの公開schemaを定義し、そのschemaで応答を絞り込む。HonoのAppTypeにも入力・応答型を伝播する。

## 関連と順序

カテゴリは店舗への外部キーを持ち、商品は店舗への外部キーに加えて `(storeId, categoryId)` でカテゴリの `(storeId, id)` を参照する。別店舗カテゴリへの商品の登録・変更はDBで拒否する。店舗削除時はカテゴリ・商品、カテゴリ削除時は商品を連鎖削除する。

カテゴリは `sortOrder` 昇順、同順位はUUID昇順。各カテゴリ内の商品も同じ規則。店舗・順序・ID、店舗・カテゴリ・順序・IDにそれぞれindexを設ける。

店舗1件、対象店舗の全カテゴリ、対象店舗の全商品を3クエリで取得し、商品を一度ずつカテゴリへ分類する。カテゴリごとのSQLは発行しない。別店舗データはDBの店舗条件と複合外部キーで分離する。ページングは行わない。

## 検証と範囲外

専用PostgreSQLで認可、ID・query検証、404、空メニュー・空カテゴリ、並び順と同順位、売り切れ・停止店舗、状態変更の再読込、他店舗混入防止、公開項目、外部キーと金額制約を確認する。既存検索・住所・認証の統合テストも実行する。

F11管理APIと画像保存先は [メニュー管理](menu-management.md) を参照する。この取得APIでは画像アップロード、F06注文・カートへの追加可否、注文確定時の再確認、本番seedは対象外。`photoUrl` は保存値の読み取りのみで、画像の取得や検証は行わない。
