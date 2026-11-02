# 認証

F-01 の API は Better Auth と PostgreSQL / Drizzle を使う。公開経路は Hono の型付きルートに限定し、`hc<AppType>()` で呼び出す。Better Auth の任意のエンドポイントは公開しない。

## API

| メソッド・パス                       | 入力                                                                                             | 結果                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `GET /auth/policies`                 | —                                                                                                | 現在の利用規約・プライバシーポリシーの版                |
| `POST /auth/sign-up/email`           | name, email, password, phoneNumber, termsAccepted, privacyAccepted, termsVersion, privacyVersion | 確認メールを送り `{ status: true }`。自動ログインしない |
| `POST /auth/sign-in/email`           | email, password                                                                                  | 公開プロフィールとセッション Cookie / `set-auth-token`  |
| `POST /auth/sign-out`                | —                                                                                                | セッションを削除し Cookie を消す                        |
| `GET /auth/me`                       | セッション                                                                                       | id・氏名・メール・確認済みか・電話番号・ロール          |
| `POST /auth/send-verification-email` | email                                                                                            | 確認メールを再送する                                    |
| `GET /auth/verify-email`             | token（クエリ）                                                                                  | 確認後に固定の `WEB_URL/login?verified=true` へ移動する |
| `POST /auth/request-password-reset`  | email                                                                                            | 再設定メールを送る。登録の有無によらず同じ応答          |
| `POST /auth/reset-password`          | token, newPassword                                                                               | パスワードを変え、既存の全セッションを無効にする        |

メールは小文字にそろえ、電話番号は空白・ハイフンを除いた数字 10〜15 桁（先頭の `+` は任意）にする。登録には両文書への同意と現在の版が必要。文書はまだ仮のため、版は `draft-2026-11-01` として記録する。文書を変更するときは `packages/domain/src/auth/access.ts` の版も更新する。

## ロールとアクセス

公開登録で作れるのは `customer` だけ。`store`・`courier`・`admin` は運営によるアカウント発行の機能で扱う。登録時に role・disabled・emailVerified を持ち込むと 400 になる。登録・同意の日時はサーバーで記録する。

`requireSession` はユーザーを DB から読み直し、未認証・期限切れ・削除済みは 401、停止済みは 403 にする。`requireRole` は許可したロール以外を 403 にする。注文の作成では `requireRole(['customer'], true)` を使い、メール未確認なら 403 にする。ログインもメール確認後だけ許可する（R-14）。

## セッションとメール

- Web は `credentials: 'include'` で Cookie を送る。Cookie は HttpOnly・SameSite=Lax、本番は Secure。Web と API は同じサイト内に配置する。
- アプリはログイン応答の `set-auth-token` にある署名付きトークンを端末の安全な領域に保存し、`Authorization: Bearer ...` で送る。保存する処理と画面は F-01 のクライアント実装で追加する。生のセッショントークンは受け付けない。
- セッションは 7 日間で、1 日ごとに有効期限を更新する。停止・ロールの変更をすぐ反映するため Cookie 内のユーザーキャッシュは使わない。
- 確認リンクは 1 時間、再設定リンクは 30 分。再設定トークンの識別子はハッシュ化して保存し、トランザクション内で 1 回だけ使用する。再設定後は全セッションを取り消す。
- 確認後は Web の `/login`、再設定メールからは `/reset-password?token=...` を開く。アプリからの再設定もこの Web の画面を使う。
- メール送信は SMTP のアダプタで行い、ローカルは Mailpit に送る。本番の SMTP は TLS を必須にする。送信は応答の後に行い、失敗時は個人情報を含めないイベントを記録する。確認メールは再送 API、再設定メールは再設定要求から送り直せる。

## リクエストの扱い

認証 API はキャッシュしない。Cookie を使う変更要求では Origin を検査する。サーバー側から変更 API を呼ぶときも許可した Web の Origin を転送する。Bearer があるときは Cookie へフォールバックしない。CORS は設定した Web の Origin だけを許可する。

接続元 IP は Node サーバーから取得し、外部からの `x-auth-client-ip` や `x-forwarded-for` で置き換えさせない。ログインは 1 分 10 回、登録・確認メール再送・再設定メール要求は各 1 分 5 回、Better Auth に転送するその他の認証操作は 1 分 100 回を上限に DB で数える。制限時は 429 と `Retry-After` を返す。プロキシ配下で配備する場合は、接続元 IP を取得する構成をデプロイ時に設定する。

エラーの記録には個人情報やトークンを残さず、イベント名とサーバーで発行したリクエスト ID を使う。API 全体でリクエスト本文は最大 16 KiB とする。

## Web の画面

| URL                         | 画面                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `/login`                    | S-C01。確認が必要な場合は確認メールを再送できる                         |
| `/sign-up`                  | S-C02。規約への同意、登録後の確認メールの案内                           |
| `/forgot-password`          | S-C03。再設定メールの要求                                               |
| `/reset-password?token=...` | S-C03。新しいパスワードの入力                                           |
| `/account`                  | S-C11。登録情報・メールの確認状況・お届け先と規約へのリンク・ログアウト |
| `/terms`・`/privacy`        | S-C12・S-C13。`docs/legal/` の本文を表示する                            |

未ログインで `/` や `/account` を開くと `/login` に移動する。ログイン済みで `/login`・`/sign-up` を開くと `/` に移動する。注文者以外や停止済みのセッションでは `/access-denied` でログアウトを案内する。規約と再設定の画面は未ログインでも開ける。

layout での初回の確認に加えて、利用者の情報を表示するページでも共通の確認処理を呼ぶ。画面移動とタブへの復帰ではクライアントからもセッションを確認し、その応答で Cookie の有効期限を更新する。API の結果はキャッシュしない。Cookie・トークンは localStorage に保存しない。

Web と API を別のホストに置くときは、API の `AUTH_COOKIE_DOMAIN` に両者が属する管理下の共通ドメイン（例: `example.com`）を設定する。共有範囲内には信頼するサービスだけを置く。未設定または両者の共通ドメインでない場合は API の起動時にエラーにする。同じホストの localhost 開発では設定しない。

再設定のトークンは読み込み後にブラウザの URL から除き、画面に `no-referrer` を設定する。Next.js の開発用ログもこの URL を記録しない。配備先のアクセスログでもクエリを記録しないようにする。

店舗一覧（`/`）とお届け先（`/addresses`）は認証済みの案内画面を置く。店舗の表示は F-03、お届け先の一覧・登録・編集は F-02 の対応で追加する。
