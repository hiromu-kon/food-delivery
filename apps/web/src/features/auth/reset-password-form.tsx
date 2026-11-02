'use client';

import { emailSchema, resetPasswordSchema } from '@repo/contract';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { TextField } from '@/components/ui/text-field';
import { assertAuthSuccess, FormError, useAuthForm } from './auth-form';

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useAuthForm(emailSchema, async (data) => {
    await assertAuthSuccess(await apiClient.auth['request-password-reset'].$post({ json: data }));
    setSent(true);
  });
  return (
    <div className="space-y-6">
      {sent && (
        <NoticeBanner role="status">
          アカウントがある場合、再設定メールを送りました。30
          分以内にリンクを開いてください。迷惑メールのフォルダも確認してください。
        </NoticeBanner>
      )}
      <form noValidate onSubmit={(event) => void form.onSubmit(event)} className="space-y-6">
        <FormError error={form.error} />
        <TextField
          name="email"
          label="メールアドレス"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          errorMessage={form.fields.email}
        />
        <Button type="submit" loading={form.pending} className="w-full">
          再設定メールを送る
        </Button>
      </form>
      <p className="text-body-s text-brand text-center">
        <Link href="/login" className="underline underline-offset-4">
          ログイン画面へ戻る
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  // リンクのトークンを、以降の履歴と Referer に残さない
  useEffect(() => {
    window.history.replaceState(null, '', '/reset-password');
  }, []);
  const form = useAuthForm(resetPasswordSchema, async (data, element) => {
    await assertAuthSuccess(await apiClient.auth['reset-password'].$post({ json: data }));
    element.reset();
    setDone(true);
  });
  if (done)
    return (
      <div className="space-y-6">
        <NoticeBanner role="status">
          パスワードを変更しました。新しいパスワードでログインしてください。
        </NoticeBanner>
        <Button asChild className="w-full">
          <Link href="/login">ログイン画面へ進む</Link>
        </Button>
      </div>
    );
  if (!token)
    return (
      <div className="space-y-6">
        <NoticeBanner tone="warning">再設定メールのリンクから開いてください。</NoticeBanner>
        <Button asChild className="w-full">
          <Link href="/forgot-password">再設定メールを送る</Link>
        </Button>
      </div>
    );
  return (
    <form noValidate onSubmit={(event) => void form.onSubmit(event)} className="space-y-6">
      <FormError error={form.error} />
      <input type="hidden" name="token" value={token} />
      <TextField
        name="newPassword"
        label="新しいパスワード"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        helperText="8〜128 文字で入力してください。"
        errorMessage={form.fields.newPassword}
      />
      <Button type="submit" loading={form.pending} className="w-full">
        パスワードを変更する
      </Button>
      <p className="text-body-s text-brand text-center">
        <Link href="/forgot-password" className="underline underline-offset-4">
          再設定メールを送り直す
        </Link>
      </p>
    </form>
  );
}
