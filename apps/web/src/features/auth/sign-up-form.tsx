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
  const [accepted, setAccepted] = useState(false);
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
        helperText="配達員にお伝えします"
        autoComplete="name"
        maxLength={100}
        required
        errorMessage={form.fields.name}
      />
      <TextField
        name="email"
        label="メールアドレス"
        type="email"
        helperText="確認のメールを送ります"
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
      <input type="hidden" name="termsAccepted" value={accepted ? 'on' : ''} />
      <input type="hidden" name="privacyAccepted" value={accepted ? 'on' : ''} />
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${id}-consent`}
            data-field="termsAccepted"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
            required
            aria-invalid={Boolean(form.fields.termsAccepted || form.fields.privacyAccepted)}
            aria-describedby={`${id}-consent-error`}
          />
          <Label htmlFor={`${id}-consent`}>利用規約とプライバシーポリシーに同意する</Label>
        </div>
        <div className="text-body-s text-brand flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
            利用規約を読む（新しいタブ）
          </Link>
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            プライバシーポリシーを読む（新しいタブ）
          </Link>
        </div>
        <p id={`${id}-consent-error`} className="text-body-s text-danger">
          {form.fields.termsAccepted || form.fields.privacyAccepted}
        </p>
      </div>
      <Button type="submit" className="w-full" loading={form.pending}>
        登録する
      </Button>
      <p className="text-body-s text-brand text-center">
        <Link href="/login" className="underline underline-offset-4">
          ログイン画面へ戻る
        </Link>
      </p>
    </form>
  );
}
