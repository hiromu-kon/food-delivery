'use client';

import { signInSchema, adminMeResponseSchema } from '@repo/contract';
import { useEffect, useRef, useState } from 'react';

import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { TextField } from '@/components/ui/text-field';
import {
  AuthRequestError,
  assertAuthSuccess,
  FormError,
  useAuthForm,
} from '@/features/auth/auth-form';
import { signOutAdmin, adminDeniedMessage } from './requests';

export function AdminLoginForm({ denied }: { denied: boolean }) {
  const [cleanup, setCleanup] = useState(denied);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const cleanupLocked = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function clearSession() {
    if (cleanupLocked.current) return;
    cleanupLocked.current = true;
    try {
      await signOutAdmin();
      if (!active.current) return;
      setCleanupFailed(false);
      setCleanup(false);
    } catch {
      if (!active.current) return;
      setCleanupFailed(true);
    } finally {
      cleanupLocked.current = false;
    }
  }
  useEffect(() => {
    if (!denied || cleanupLocked.current) return;
    cleanupLocked.current = true;
    void signOutAdmin()
      .then(() => {
        if (active.current) setCleanup(false);
      })
      .catch(() => {
        if (active.current) setCleanupFailed(true);
      })
      .finally(() => {
        cleanupLocked.current = false;
      });
  }, [denied]);
  const form = useAuthForm(signInSchema, async (data, element) => {
    const response = await apiClient.auth['sign-in'].email.$post({ json: data });
    if (!active.current) return;
    if (!response.ok) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        body &&
        typeof body === 'object' &&
        'code' in body &&
        (body.code === 'ACCOUNT_DISABLED' || body.code === 'EMAIL_NOT_VERIFIED')
      ) {
        throw new AuthRequestError(adminDeniedMessage);
      }
      await assertAuthSuccess(response);
    }
    const context: Response = await apiClient.admin.me.$get({ query: {} });
    if (!active.current) return;
    if (context.status === 401 || context.status === 403) {
      try {
        await signOutAdmin();
      } catch {
        if (!active.current) return;
        setCleanup(true);
        setCleanupFailed(true);
        throw new AuthRequestError(
          `${adminDeniedMessage} ログアウトできませんでした。再試行してください。`,
        );
      }
      throw new AuthRequestError(adminDeniedMessage);
    }
    await assertAuthSuccess(context);
    adminMeResponseSchema.parse(await context.json());
    if (!active.current) return;
    element.reset();
    window.location.replace('/admin');
  });
  return (
    <>
      {denied && (
        <NoticeBanner tone="danger" role="alert">
          {adminDeniedMessage}
        </NoticeBanner>
      )}
      {cleanupFailed && (
        <div className="space-y-3">
          <NoticeBanner tone="danger" role="alert">
            ログアウトできませんでした。接続を確認し、再試行してください。
          </NoticeBanner>
          <Button variant="secondary" onClick={() => void clearSession()}>
            ログアウトを再試行
          </Button>
        </div>
      )}
      <form noValidate onSubmit={(event) => void form.onSubmit(event)} className="space-y-5">
        <FormError error={form.error} />
        <TextField
          name="email"
          label="メールアドレス"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="admin@example.jp"
          maxLength={254}
          required
          errorMessage={form.fields.email}
          disabled={cleanup}
        />
        <TextField
          name="password"
          label="パスワード"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          errorMessage={form.fields.password}
          disabled={cleanup}
        />
        <Button type="submit" loading={form.pending} disabled={cleanup} className="w-full">
          ログインする
        </Button>
      </form>
      <p className="text-body-s text-secondary">
        パスワードを忘れたときは、管理者に連絡してください
      </p>
    </>
  );
}
