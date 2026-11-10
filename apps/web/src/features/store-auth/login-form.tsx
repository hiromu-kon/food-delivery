'use client';

import { signInSchema, storeMeResponseSchema } from '@repo/contract';
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
import { signOutStore, storeDeniedMessage } from './requests';

export function StoreLoginForm({ denied }: { denied: boolean }) {
  const [cleanup, setCleanup] = useState(denied);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const cleanupLocked = useRef(false);
  async function clearSession() {
    if (cleanupLocked.current) return;
    cleanupLocked.current = true;
    try {
      await signOutStore();
      setCleanupFailed(false);
      setCleanup(false);
    } catch {
      setCleanupFailed(true);
    } finally {
      cleanupLocked.current = false;
    }
  }
  useEffect(() => {
    if (!denied || cleanupLocked.current) return;
    cleanupLocked.current = true;
    void signOutStore()
      .then(() => setCleanup(false))
      .catch(() => setCleanupFailed(true))
      .finally(() => {
        cleanupLocked.current = false;
      });
  }, [denied]);
  const form = useAuthForm(signInSchema, async (data, element) => {
    const response = await apiClient.auth['sign-in'].email.$post({ json: data });
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
        throw new AuthRequestError(storeDeniedMessage);
      }
      await assertAuthSuccess(response);
    }
    const context: Response = await apiClient.store.me.$get({ query: {} });
    if (context.status === 401 || context.status === 403) {
      try {
        await signOutStore();
      } catch {
        setCleanup(true);
        setCleanupFailed(true);
        throw new AuthRequestError(
          `${storeDeniedMessage} ログアウトできませんでした。再試行してください。`,
        );
      }
      throw new AuthRequestError(storeDeniedMessage);
    }
    await assertAuthSuccess(context);
    storeMeResponseSchema.parse(await context.json());
    element.reset();
    window.location.replace('/store');
  });
  return (
    <>
      {denied && (
        <NoticeBanner tone="danger" role="alert">
          {storeDeniedMessage}
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
          placeholder="staff@example.jp"
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
      <p className="text-body-s text-secondary">パスワードを忘れたときは、運営に連絡してください</p>
    </>
  );
}
