'use client';

import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { NoticeBanner } from '@/components/ui/notice-banner';

const fieldMessages: Record<string, string> = {
  name: '氏名を 100 文字以内で入力してください。',
  email: 'メールアドレスを確認してください。',
  password: 'パスワードを入力してください（登録時は 8〜128 文字）。',
  newPassword: '新しいパスワードを 8〜128 文字で入力してください。',
  phoneNumber: '電話番号を数字 10〜15 桁で入力してください。',
  termsAccepted: '利用規約への同意が必要です。',
  privacyAccepted: 'プライバシーポリシーへの同意が必要です。',
};
export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function assertAuthSuccess(response: Response) {
  if (response.ok) return;
  const parsed = z.object({ code: z.string() }).safeParse(await response.json().catch(() => null));
  const code = parsed.success ? parsed.data.code : '';
  const messages: Record<string, string> = {
    EMAIL_NOT_VERIFIED: 'メールアドレスを確認してください。確認メールを送り直すこともできます。',
    ACCOUNT_DISABLED: 'このアカウントは利用できません。',
    INVALID_CREDENTIALS: 'メールアドレスまたはパスワードを確認してください。',
    INVALID_OR_EXPIRED_TOKEN:
      'リンクが無効か、有効期限が切れています。再設定メールを送り直してください。',
    RATE_LIMITED: '操作の回数が多いため、1 分ほど待ってからもう一度お試しください。',
    VALIDATION_ERROR:
      '入力内容を確認してください。規約の版が変わった場合は画面を更新してください。',
  };
  throw new AuthRequestError(
    messages[code] ?? '処理できませんでした。時間をおいてもう一度お試しください。',
    code,
  );
}

export function useAuthForm<T>(
  schema: z.ZodType<T>,
  onValid: (data: T, form: HTMLFormElement) => Promise<void>,
) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthRequestError>();
  const [fields, setFields] = useState<Record<string, string>>({});
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parsed = schema.safeParse({
      ...values,
      ...(values.termsAccepted !== undefined && { termsAccepted: values.termsAccepted === 'on' }),
      ...(values.privacyAccepted !== undefined && {
        privacyAccepted: values.privacyAccepted === 'on',
      }),
    });
    setError(undefined);
    setFields({});
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '');
        errors[field] = fieldMessages[field] ?? '入力内容を確認してください。';
      }
      setFields(errors);
      const field = Object.keys(errors)[0] ?? '';
      const first =
        form.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`) ??
        form.elements.namedItem(field);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    locked.current = true;
    setPending(true);
    try {
      await onValid(parsed.data, form);
    } catch (error) {
      setError(
        error instanceof AuthRequestError
          ? error
          : new AuthRequestError('通信できませんでした。接続を確認して、もう一度お試しください。'),
      );
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return { onSubmit, pending, error, fields };
}

export function FormError({ error }: { error?: AuthRequestError | undefined }) {
  return error ? (
    <NoticeBanner tone="danger" role="alert">
      {error.message}
    </NoticeBanner>
  ) : null;
}
