# F-06 注文作成・仮売上API

注文作成と仮売上の契約・再送・障害復旧の仕様。注文参照・受付前の取消は [order-status.md](order-status.md) を参照する。

## 契約

`POST /orders`。ログイン済み・メール確認済みの customer が利用できる。停止アカウント、他ロール、未確認メールを拒否する。Cookie認証は既存のOrigin検証を適用し、Bearer認証も既存ミドルウェアに従う。

`Content-Type: application/json` と `Idempotency-Key: <UUID>` が必須。CORSでこのヘッダーを許可する。

```json
{
  "storeId": "00000000-0000-4000-8000-000000000001",
  "addressId": "00000000-0000-4000-8000-000000000002",
  "items": [{ "menuItemId": "00000000-0000-4000-8000-000000000003", "quantity": 2 }],
  "fulfillment": "hand_delivery",
  "paymentMethodId": "pm_CLIENT_SDK_TOKEN"
}
```

- 商品は1〜100種類、各数量は整数1〜20、重複商品IDは禁止。商品IDはメニューAPIが返すIDを使う。
- 金額・単価・商品名・座標などの追加フィールドは400。APIがDBの値を採用する。
- `fulfillment` は `hand_delivery` / `leave_at_door`。
- 置き配では `dropoffLocation` が必須で、`front_door` / `delivery_box` / `other`。手渡しでは指定不可。
- `deliveryNote` は任意・100文字以内。省略時は所有住所の保存済みメモを採用する。`other` では明示した空でないメモが必須。
- `paymentMethodId` はStripe SDKで取得したカードのPaymentMethod ID。カード番号・CVC・クライアントからのPaymentIntent IDは受け付けない。

成功は `201 { order }`。`order` は保存済みのID、customer/store ID、`status: pending`、subtotal、deliveryFee、total、受け取り方法、住所・建物・座標・配達メモのスナップショット、paymentIntentId、createdAt、itemsを含む。itemsは保存済み行のID、orderId、menuItemId、name、unitPrice、quantity。日時はJSONのISO文字列。Stripeのclient secret・カード情報・paymentMethodIdは返さない。再送も同じ注文を201で返す。

同じキーは同じcustomerの同じ正規化済み入力にだけ再利用できる。商品の並び順は正規化する。違う入力は409 `IDEMPOTENCY_CONFLICT`。成功後にメニューや住所が変わっても再送は保存済み注文を返す。

| HTTP | code                            | 意味・クライアント対応                                                       |
| ---- | ------------------------------- | ---------------------------------------------------------------------------- |
| 400  | VALIDATION_ERROR                | 入力・Idempotency-Key不正                                                    |
| 401  | UNAUTHORIZED                    | ログインが必要                                                               |
| 403  | 既存の認証エラー                | ロール・メール確認・停止・Originの条件違反                                   |
| 404  | NOT_FOUND                       | 所有するお届け先がない。他人の住所も同じ応答                                 |
| 409  | IDEMPOTENCY_CONFLICT            | 同じキーで異なる注文を送った                                                 |
| 422  | ORDER_NOT_ORDERABLE             | 店舗停止、エリア外、不正商品、売切れ、最低額未達、確定前の見積もり変更など   |
| 402  | PAYMENT_FAILED                  | 仮売上失敗、追加認証が必要、取消済みの試行。内容を確認して新しいキーで再注文 |
| 503  | PAYMENT_UNAVAILABLE             | 未設定、Stripe通信・レート制限・サービス障害。同じ入力とキーで再送           |
| 503  | PAYMENT_RECONCILIATION_REQUIRED | DB/Stripeの結果照合・取消が未完了。同じ入力とキーで再送し、新規注文は控える  |
| 500  | INTERNAL_SERVER_ERROR           | その他のDB障害など。同じ入力とキーで結果確認                                 |

## DBと金額の正本

`order_settings` のsingleton行（id=1）に全店舗共通配達料を保存し、migrationで300円を設定する。変更は運営側のDB管理経路から行う。この変更に設定UI・設定APIは含めない。

R-01は所有住所と店舗の保存済み座標からdomainの直線距離計算で判定する。R-02〜04は保存済み商品単価、所属店舗、数量、店舗の最低額と配達料でdomainのカート関数を呼ぶ。最低額は配達料を含まない。Stripeの金額上限を超える合計は注文不可とする。

`orders` / `order_items` に商品名・税込単価・数量・小計・配達料・合計、住所と受け取り方法を保存する。商品IDは元商品の参照情報で、削除後もスナップショットを保持する。customer・storeへのFKは履歴の削除を防ぐ。注文状態の許容遷移はdomainの `canTransitionOrder` に定義する。操作主体・担当配達員・売上確定等の条件は後続APIで追加する。

## 決済と整合性

1. 検証済み見積もりと入力のSHA-256を `checkout_attempts` に保存する。キーはcustomerごとに一意。カード情報は保存しない。
2. 試行ID由来の `:create` キーで未確認のPaymentIntentを作成する。通貨JPY、cardのみ、`capture_method=manual`、`confirmation_method=manual`。この段階では仮売上もしない。
3. intent IDをDBに保存してから仮売上を試す。ここまでのDB障害では未確認intentしか存在しない。同一キーで安全に再開できる。
4. 試行行を排他ロックし、既存注文を先に確認する。店舗・住所・設定・商品を共有行ロックして再検証し、最初の見積もりと比較する。受付停止・売切れ・価格変更は仮売上前に拒否する。これらの行ロックは決済・注文保存のcommitまで保持する。
5. `:confirm` キーで仮売上する。intentがmanual / JPY / 金額一致 / `requires_capture` / 全額capturableのときだけ、同じDBトランザクションでpending注文と商品を保存する。captureは呼ばない。
6. 失敗時は別トランザクションで試行をロックし、commit応答だけが失われた可能性を先に確認する。注文が存在すれば成功を返し、取り消さない。未保存なら `:cancel` キーで仮売上を取り消す。
7. 取消失敗時も試行を失敗状態で永続化し、503を返す。再送は再仮売上せず取消を再試行する。DB全停止などで記録更新もできなくても、既存の試行とintent IDを使って次回照合できる。

Stripe操作とDB commitは分散トランザクションではない。プロセス強制終了・DBとStripeの同時障害では、一時的に仮売上だけが残る可能性があり、永続試行からの同一キー再送で照合または取消する。DB障害を理由に成功応答や未認証pendingを作らない。初回作成応答不明のまま23時間を超えた試行は、Stripeの最低24時間のキー保持期限を考慮して再作成を停止し、運用照合を要求する。古い試行の定期照合・webhook処理は今後必要。

## 設定・制約

`STRIPE_SECRET_KEY` は任意。未設定なら注文作成は503となる。この初期実装は `sk_test_` のみを許可し、live key / livemode応答を拒否する。API versionは `2026-10-28.endive` に固定し、各HTTP操作に10秒のtimeoutを付ける。

追加認証（3DS等）のフローは未実装で、requires_actionは取消して402とする。本番利用には追加認証と本番用設定の設計、監視・自動照合が必要。結合テストでは StripeClient を注入し、実 Stripe との通信は行わない。

配達メモの公開は操作主体と用途に応じて API で制限する。配達員向け API では担当の認可が必要。

## 検証

新規の専用コンテナ `food-delivery-issue30-test`（PostgreSQL 18、127.0.0.1:15430、tmpfs）を使う。既存開発DB・他作業のテストDBには接続しない。テストは `TEST_DATABASE_URL` のDB名が `food_delivery_test` でなければ停止する。

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:15430/food_delivery_test pnpm check
pnpm format:check
git diff --check
```

注文の結合テストは偽Stripeを注入し、正本金額・価格改ざん拒否・住所所有権・配達範囲・店舗停止・売切れ・別店舗/不明商品・数量・最低額境界・スナップショット・受け取り方法・認証・同時再送を検証する。障害系ではDB rollback、commit応答不明、create応答不明、intent保存失敗、confirm応答不明、取消失敗と再送、古いキーの再作成拒否を検証する。HTTPアダプタは注入したfetchだけを使用し、manual/未confirm作成・操作別キー・live拒否・失敗マッピングを確認する。domainは全状態の遷移組み合わせを検査する。

参照: [PaymentIntent作成](https://docs.stripe.com/api/payment_intents/create)、[confirm](https://docs.stripe.com/api/payment_intents/confirm)、[cancel](https://docs.stripe.com/api/payment_intents/cancel)、[idempotency](https://docs.stripe.com/api/idempotent_requests)。
