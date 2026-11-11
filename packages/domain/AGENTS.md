# packages/domain

- 金額・日付・状態遷移の計算を `src/<領域>/` に純関数として置く。
- 時刻・乱数は引数で受け取る。`Date.now()` / `new Date()` / `Math.random()` を直接呼ばない（テストで時刻を固定できなくなる）。
- 業務エラーは `src/errors.ts` の `DomainError` を投げる。コードを足したら `apps/api/src/middleware/error-handler.ts` に HTTP ステータスを足す（足さないと型エラーになる）。
