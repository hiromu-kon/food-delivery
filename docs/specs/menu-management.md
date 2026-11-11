# 仕様：メニュー管理（F-11 / Issue52）

店舗Web（Issue53 / S-S04・S-S05）の操作は [menu-management-web.md](menu-management-web.md) を参照する。

店舗スタッフが所属店舗のカテゴリ・商品を管理する。注文者の `GET /stores/:storeId/menu` の URL・応答・認可は変更しない。

## API

すべて `/store/menu` 配下。既存の `requireSession` → `requireStoreContext` を使用する。Cookie または署名 Bearer に対応し、Cookie の書込には許可 Origin が必要。未認証は401、有効・メール確認済みの store role と所属がない場合は403。認可は入力検証より先に行う。成功・エラーとも `Cache-Control: no-store`。query は空キー・重複キーも含めすべて拒否する。

| メソッドとパス                              | 成功応答                                              |
| ------------------------------------------- | ----------------------------------------------------- |
| `GET /store/menu`                           | 200 `{ categories: [{ ...category, items: [...] }] }` |
| `GET /store/menu/categories/:categoryId`    | 200 `{ category }`                                    |
| `POST /store/menu/categories`               | 201 `{ category }`                                    |
| `PATCH /store/menu/categories/:categoryId`  | 200 `{ category }`                                    |
| `DELETE /store/menu/categories/:categoryId` | 204、本文なし                                         |
| `GET /store/menu/items/:itemId`             | 200 `{ item }`                                        |
| `POST /store/menu/items`                    | 201 `{ item }`                                        |
| `PATCH /store/menu/items/:itemId`           | 200 `{ item }`                                        |
| `DELETE /store/menu/items/:itemId`          | 204、本文なし                                         |
| `PATCH /store/menu/items/:itemId/soldout`   | 200 `{ item }`                                        |

カテゴリの入力は `name`（trim後1〜100文字）、`description`（1000文字以内）、`photoUrl`（2048文字以内の絶対HTTPS URLまたはnull）、`sortOrder`（0〜2147483647の整数）。作成時はname必須、説明は空文字、画像はnull、順序は0が初期値。商品はこれに `categoryId`（必須UUID）、`price`（必須、0〜2147483647の整数円）、`soldout`（初期値false）を加える（R-02）。PATCHは1項目以上を必須とし、省略項目を保持する。画像の削除はnullを指定する。売り切れ専用PATCHは `{ soldout: boolean }` を必須とし、同値再送も成功する（R-10）。未知キー、本文の店舗ID・ユーザーID、型不正、UUID形式不正は400。JSON解析失敗は既存共通ハンドラーの400。

カテゴリの公開項目は注文者contractと同じ。管理用商品には追加で `categoryId` を返す。店舗IDや認証情報は返さない。一覧はカテゴリ・カテゴリ内商品の `sortOrder`、UUID昇順。空カテゴリは空のitems、空メニューは空のcategories。

## 店舗分離と削除

所属店舗はguardのcontextだけから取得する。全SQLに店舗条件を付け、他店と不存在のカテゴリ・商品は同じ404。商品登録・移動先のカテゴリも同店舗であることを検証する。全操作はトランザクション内で本人・所属を再照合し、usersと所属行を更新ロックする。guard後に所属や権限が変わった場合は403となり、照合後の所属変更はcommitまで待機する。商品登録・移動時はカテゴリ行もロックし、削除との競合を防ぐ。既存の店舗・カテゴリ複合FKも維持する。

カテゴリ削除は既存FKにより所属商品を連鎖削除する。商品の個別削除も物理削除。再削除は404。注文の `order_items.menu_item_id` は元の商品IDの記録でありメニューへのFKを持たないため、注文行や `checkout_attempts.quote` を削除・書換しない。注文時の商品名・単価・合計は価格変更・商品削除・カテゴリ削除後も保持する（R-13）。既存の注文時再検証は削除済み・売り切れ商品を拒否する。DBスキーマ変更・移行は不要。

## 画像の保存先

MVPでは既存の Next.js Web デプロイの静的ファイル配信を利用する。運営が確認済みの JPEG / PNG / WebP を `apps/web/public/menu-images/<store UUID>/<content hash>.<拡張子>` に配置し、Webの実際のHTTPS originに `/menu-images/...` を付けたURLを店舗に渡す。これをphotoUrlに登録する。画像自体はWebのデプロイ成果物に保存し、PostgreSQLにはURLのみ保存する。新しい外部サービス・有料ストレージ・本番資格情報を必要としない。ローカルHTTP開発ではphotoUrlをnullにするか、既に利用できるHTTPS配信URLを使う。

管理APIはURLの構文だけを検証し、画像を取得しない。任意URLへのサーバー側アクセスは発生しない。バイナリアップロード・署名URL・画像変換APIは提供しない。店舗スタッフが直接ファイルをアップロードする運用は今後の機能とし、現時点では運営による配置が必要。置換時は別ハッシュのファイルを追加してURLを更新し、旧画像の削除は利用状況を確認して別デプロイで行う。APIのカテゴリ・商品削除は配信ファイルを削除しない。顧客アプリは絶対URLをそのまま使用できる。
