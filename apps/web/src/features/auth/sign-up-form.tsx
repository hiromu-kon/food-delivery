'use client';

import { signUpSchema } from '@repo/contract';
import { legalDocumentVersions } from '@repo/domain';
import Link from 'next/link';
import { useId, useState } from 'react';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { TextField } from '@/components/ui/text-field';
import { assertAuthSuccess, FormError, useAuthForm } from './auth-form';
import { VerificationForm } from './login-form';

export function SignUpForm() {
  const id = useId();
  const [email, setEmail] = useState<string>();
  const form = useAuthForm(signUpSchema, async (data, element) => {
    await assertAuthSuccess(await apiClient.auth['sign-up'].email.$post({ json: data }));
    setEmail(data.email);
    element.reset();
  });
  if (email)
    return (
      <div className="space-y-6">
        <NoticeBanner role="status">
          登録を受け付けました。メールのリンクを開いてからログインしてください。すでに登録済みの場合は、そのパスワードでログインできます。
        </NoticeBanner>
        <p className="text-body-m break-all">メールの送り先：{email}</p>
        <Button asChild className="w-full">
          <Link href="/login">ログイン画面へ進む</Link>
        </Button>
        <details className="border-t pt-5">
          <summary className="text-body-s text-brand cursor-pointer">
            確認メールが届かないとき
          </summary>
          <div className="mt-4">
            <VerificationForm email={email} />
          </div>
        </details>
      </div>
    );
  return (
    <form noValidate onSubmit={(event) => void form.onSubmit(event)} className="space-y-6">
      <FormError error={form.error} />
      <TextField
        name="name"
        label="氏名"
        autoComplete="name"
        maxLength={100}
        required
        errorMessage={form.fields.name}
      />
      <TextField
        name="email"
        label="メールアドレス"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        required
        errorMessage={form.fields.email}
      />
      <TextField
        name="password"
        label="パスワード"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        helperText="8〜128 文字で入力してください。"
        required
        errorMessage={form.fields.password}
      />
      <TextField
        name="phoneNumber"
        label="電話番号"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={32}
        helperText="配達時のご連絡に使います。"
        required
        errorMessage={form.fields.phoneNumber}
      />
      <input type="hidden" name="termsVersion" value={legalDocumentVersions.terms} />
      <input type="hidden" name="privacyVersion" value={legalDocumentVersions.privacy} />
      <div className="space-y-4 border-t pt-6">
        <p className="text-body-s text-secondary">内容を確認して、同意してください。</p>
        {[
          { name: 'termsAccepted', title: '利用規約', href: '/terms' },
          { name: 'privacyAccepted', title: 'プライバシーポリシー', href: '/privacy' },
        ].map(({ name, title, href }) => (
          <div key={name}>
            <div className="flex items-start gap-3">
              <Checkbox
                id={`${id}-${name}`}
                data-field={name}
                name={name}
                required
                aria-invalid={Boolean(form.fields[name])}
                aria-describedby={form.fields[name] ? `${id}-${name}-error` : undefined}
              />
              <div className="space-y-2">
                <Label htmlFor={`${id}-${name}`}>{title}に同意します</Label>
                <Link
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-s text-brand underline underline-offset-4"
                >
                  {title}を読む（新しいタブ）
                </Link>
              </div>
            </div>
            {form.fields[name] && (
              <p id={`${id}-${name}-error`} className="text-body-s text-danger mt-2">
                {form.fields[name]}
              </p>
            )}
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full" loading={form.pending}>
        同意して登録する
      </Button>
      <p className="text-body-s text-brand text-center">
        <Link href="/login" className="underline underline-offset-4">
          ログイン画面へ戻る
        </Link>
      </p>
    </form>
  );
}
