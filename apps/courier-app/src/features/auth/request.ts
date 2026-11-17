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
    ORDER_ALREADY_ASSIGNED: 'ほかの配達員が担当したか、配達待ちではなくなりました。',
    DELIVERY_PHOTO_REQUIRED: '置き配写真の保存に対応するまで、置き配の配達完了はできません。',
    ORDER_INVALID_TRANSITION: '注文状態が変わりました。画面を再確認してください。',
    COURIER_UNAVAILABLE: '稼働中に切り替えて、もう一度お試しください。',
    COURIER_BUSY: 'すでに担当中の配達があります。担当中の配達を再確認してください。',
    NOT_FOUND: '配達待ちの注文が見つかりません。一覧を更新してください。',
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
