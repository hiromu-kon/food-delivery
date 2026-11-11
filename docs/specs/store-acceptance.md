# 仕様：受付の切替（F-12）

店舗スタッフが本人の所属店舗を受付中・停止中に切り替える。入出力の正本は `packages/contract/src/store-acceptance.ts`。店舗検索・メニューの公開契約は変更しない。

## API

`PATCH /store/acceptance`

- 既存の Cookie または署名付き Bearer で認証し、`requireSession` → `requireStoreContext` で有効・メール確認済みの store role と所属を毎回確認する。認証・認可は入力検証より先に実施する。
- 未認証・無効な Bearer・期限切れは401。停止・メール未確認・customer/courier/admin・所属なし・所属店舗削除済みは403。所属だけでは store role の代わりにならない。
- 店舗スコープは認証された本人の所属だけから決定する。パスで店舗IDを指定する経路は提供しない。本文の未知キーや店舗・利用者ID、すべての query（空キー・重複キーも含む）は400 `VALIDATION_ERROR`。
- 必須の受付状態は boolean のみを受け付ける。欠落・null・文字列・数値は400 `VALIDATION_ERROR`。壊れた JSON は既存の共通エラー処理による400 `INVALID_REQUEST`。不正入力では更新しない。
- 成功は200。更新した所属店舗IDと受付状態だけを返す。同じ値の再送も成功し、単純な反転ではなく要求された状態を保存する。
- Cookie の変更要求には共通の Origin 検査を適用する。Bearer がある場合は Cookie にフォールバックしない。認証後の応答は `Cache-Control: no-store`。

## 保存と認可

既存 `stores.isAcceptingOrders`（NOT NULL boolean、初期値true）を更新する。スキーマ・マイグレーションの追加は不要。店舗の他の項目、スタッフ所属、注文・決済は変更しない。

更新は単一 SQL で、guard が得た本人ID・店舗IDと現在の所属を照合し、users の role=store・disabled=false・emailVerified=true を WHERE 条件で再検証する。更新時に一致する店舗がなければ403で変更しない。認可後に所属を移動しても、古い店舗スコープで書き込めない。別テーブルの並行変更をリクエスト完了までロックする保証は持たず、SQL の読み取り時点の条件で判定する。

## R-09 の読み取り

切替後の `GET /stores?addressId=...` は保存された受付状態を毎回読む。配達エリア内の停止店舗も一覧に残り、`isAcceptingOrders=false` と `canOrder=false` を返す。受付再開後は両方true。距離・配達半径・並び順・住所の所有者確認は既存検索と同じ。

`GET /stores/:storeId/menu` も停止店舗の閲覧を許可し、最新の `store.isAcceptingOrders` を返す。メニューには既存どおり `canOrder` を付けない。注文確定時の再確認はF-06の責務。

## 検証と範囲外

専用 PostgreSQL の架空利用者・店舗・所属・セッションで、true/false・同値再送・Cookie/Bearer/RPC・権限と所属変更・他店舗隔離・入力拒否・更新SQLの再認可・R-09一覧とメニューへの反映を検証する。追加したテストは作成したUUIDの行だけを削除する。

native UI、スタッフ発行・所属変更、店舗管理、注文・決済の挙動は対象外。

## Web（S-S06）

`/store/settings` は既存の店舗認証 layout とクライアント guard で保護する。`GET /store/me` の本人の所属から店舗を決め、店舗認証付きの `GET /store/acceptance` で保存済み受付状態を取得する。応答は PATCH と同じ `{ store: { id, isAcceptingOrders } }`。読み取り時にも現在の所属・権限・利用停止・メール確認状態を DB で確認する。店舗 ID の指定や query は受け付けない。初期値を仮定せず、読み込み中や取得失敗時は切替を表示しない。

既存 Switch と確認ダイアログで再開・停止を選び、キャンセルでは送信しない。確定直前に所属を再確認し、表示中の店舗と一致しなければ送信しない。PATCH には希望する boolean だけを送り、同時送信を防ぎ、成功応答の状態を表示する。更新中は以前に確認した状態を表示し、操作を無効にする。401/403 は店舗ログインへ戻す。

通信断・不正な応答などで更新結果が不明な場合は状態を未確認に戻し、現在の状態の再取得だけを許可する。再送で反転させない。再読込・画面復帰時も保存済み状態を取得し直す。API の最終的な認可は既存の店舗スコープ guard と更新 SQL に委ねる。
