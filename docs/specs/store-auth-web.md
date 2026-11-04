# 店舗 Web 認証

F-09 / Issue45。API・所属条件は [店舗スタッフ認証](store-auth.md) を正本とする。運営発行済みアカウント専用の `/store/login` と `/store` の保護を提供する。公開登録・顧客の登録導線・スタッフ発行 API は提供しない。

## ログインとログアウト

メール・パスワードは既存の typed RPC `POST /auth/sign-in/email` に送信する。成功後も `GET /store/me` が成功するまで店舗画面に進めない。店舗 role、確認済みメール、有効なアカウント、存在する所属店舗の判定は API が毎回行う。別 role・停止・未確認・未所属は本人情報を表示せず、運営への問い合わせを案内する。誤った権限で発行された session は既存 `POST /auth/sign-out` で破棄を試みる。

送信中の再送信はロックする。通信失敗時は接続確認と再試行を案内する。拒否後のログアウト失敗時は再試行ボタンを表示し、完了までログイン入力を無効にする。パスワードを忘れた場合は運営への連絡を案内し、顧客の登録・再設定画面には誘導しない。

SideNav のログアウトは既存 API による Cookie 消去を受け、`/store/login` へフルナビゲーションする。失敗時は店舗枠を隠して再試行を案内する。HTTP 401 は既に失効済みとしてログインに戻す。

## サーバーと再確認

`(signed-in)/layout.tsx` と店舗データ取得境界は `requireStoreContext()` を呼ぶ。既存 `createServerApiClient()` で受信 Cookie を API に転送し、no-store で `/store/me` を取得する。React `cache` の共有は同一レンダー内のみ。401 はログイン、403 は運営連絡と session 破棄のためのログイン画面へ移動し、通信失敗は店舗情報なしの再試行画面にする。

RSC は Cookie を書き込めないため、SSR の Set-Cookie を直接反映しない。ブラウザの guard が credentials include で API を再確認し、その応答の Cookie 更新をブラウザに受けさせる。既存 customer 認証・Cookie 転送・Web/API の同一 siteOrigin の設定は変更しない。

クライアントは初回・pathname 変更・focus・pageshow・visible 復帰時に `/store/me` を再取得する。hidden になった時点でも表示を隠す。確認中・401・403・通信失敗・ログアウト失敗では SideNav/TopBar/本文を外し、以前の店舗名・メールを表示しない。要求世代と effect の有効期間を検査し、逆順応答や unmount 後の応答で状態を上書きさせない。所属変更は最新応答の店舗名に置き換える。

API は認可の正本であり、表示済み状態を権限キャッシュとして使わない。サーバー layout は遷移時に再利用されるため、今後追加する店舗データ取得処理でも `requireStoreContext()` と店舗業務 API の認可を使う。確認間の変更を push で検知する機能は含まない。

## 店舗枠とデザイン

SideNav は本人の実店舗名、TopBar は本人のメールアドレスを表示する。注文・メニュー・店舗設定のナビ先は認可された見出しだけの placeholder とし、404 にしない。業務のダミーデータ・受付状態・受付切替・F-10/F-11/F-12 の API は追加しない。

Penpot page21 の S-S01（`2531c15c-f912-8097-8008-d954248de300`）および停止 variant の実 content / appliedTokens を参照する。カード最大幅440px・desktop余白40px・brand30px・gap20px、入力とボタン48pxを使い、本文の行高はコードのトークンを維持する。狭幅では余白を縮め、縦スクロールとキーボード操作を許す。S-S02 の既存 SideNav / TopBar を再利用する。

実 PostgreSQL と実 API の fixture・再現手順・ブラウザ画像は `/tmp/issue45-store-auth-report.md` に記録する。fixture は repo 外だけに置き、DB テストの truncate と同時に使用しない。
