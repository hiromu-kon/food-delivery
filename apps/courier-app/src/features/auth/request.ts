import { z } from 'zod';

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly code = '',
    readonly status = 0,
  ) {
    super(message);
  }
}

export async function assertAuthSuccess(response: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}) {
  if (response.ok) return;
  const parsed = z.object({ code: z.string() }).safeParse(await response.json().catch(() => null));
  const code = parsed.success ? parsed.data.code : '';
  const messages: Record<string, string> = {
    EMAIL_NOT_VERIFIED: 'メールのリンクを開いて確認してからログインしてください。',
    ACCOUNT_DISABLED: 'このアカウントは利用できません。運営にお問い合わせください。',
    INVALID_CREDENTIALS: 'メールアドレスまたはパスワードを確認してください。',
    RATE_LIMITED: '操作の回数が多いため、1分ほど待ってからお試しください。',
    FORBIDDEN: '配達員の登録情報を運営に確認してください。',
    UNAUTHORIZED: 'もう一度ログインしてください。',
    VALIDATION_ERROR: '入力内容を確認して、もう一度お試しください。',
  };
  throw new AuthRequestError(
    messages[code] ?? '処理できませんでした。時間をおいてお試しください。',
    code,
    response.status,
  );
}

export function errorMessage(error: unknown) {
  return error instanceof AuthRequestError
    ? error.message
    : '通信できませんでした。接続を確認して、もう一度お試しください。';
}
