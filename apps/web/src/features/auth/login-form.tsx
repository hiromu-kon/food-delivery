'use client';

import { emailSchema, signInSchema } from '@repo/contract';
import Link from 'next/link';
import { useState } from 'react';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { TextField } from '@/components/ui/text-field';
import { AuthRequestError, assertAuthSuccess, FormError, useAuthForm } from './auth-form';

export function LoginForm({ verified }: { verified: boolean }) {
  const [resend, setResend] = useState(false);
  const form = useAuthForm(signInSchema, async (data, element) => {
    const response = await apiClient.auth['sign-in'].email.$post({ json: data });
    await assertAuthSuccess(response);
    const result = await response.json();
    if ('user' in result && result.user.role !== 'customer') {
      await assertAuthSuccess(await apiClient.auth['sign-out'].$post());
      throw new AuthRequestError(
        'ここは注文者のログイン画面です。注文者のアカウントでログインしてください。',
      );
    }
    element.reset();
    window.location.replace('/');
  });
  return (
    <>
      {verified && (
        <NoticeBanner role="status" className="mb-6">
          メールアドレスを確認しました。ログインしてください。
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
          maxLength={254}
          required
          errorMessage={form.fields.email}
        />
        <TextField
          name="password"
          label="パスワード"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          errorMessage={form.fields.password}
        />
        <div className="text-body-s text-brand text-right">
          <Link href="/forgot-password" className="underline underline-offset-4">
            パスワードを忘れた方
          </Link>
        </div>
        <Button type="submit" loading={form.pending} className="w-full">
          ログインする
        </Button>
      </form>
      {form.error?.code === 'EMAIL_NOT_VERIFIED' && (
        <div className="mt-6 border-t pt-6">
          <Button variant="secondary" className="w-full" onClick={() => setResend(true)}>
            確認メールを送り直す
          </Button>
        </div>
      )}
      {resend && (
        <div className="mt-6">
          <VerificationForm />
        </div>
      )}
      <div className="mt-8 space-y-3 border-t pt-6">
        <p className="text-body-s text-secondary text-center">はじめてご利用の方</p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/sign-up">会員登録する</Link>
        </Button>
      </div>
    </>
  );
}

export function VerificationForm({ email }: { email?: string }) {
  const [sent, setSent] = useState(false);
  const form = useAuthForm(emailSchema, async (data) => {
    await assertAuthSuccess(await apiClient.auth['send-verification-email'].$post({ json: data }));
    setSent(true);
  });
  return (
    <form noValidate onSubmit={(event) => void form.onSubmit(event)} className="space-y-4">
      <FormError error={form.error} />
      {sent && (
        <NoticeBanner role="status">
          未確認のアカウントがある場合、確認メールを送りました。迷惑メールのフォルダも確認してください。
        </NoticeBanner>
      )}
      <TextField
        name="email"
        label="確認メールの送り先"
        type="email"
        autoComplete="email"
        defaultValue={email}
        maxLength={254}
        required
        errorMessage={form.fields.email}
      />
      <Button variant="secondary" type="submit" className="w-full" loading={form.pending}>
        確認メールを送る
      </Button>
    </form>
  );
}
