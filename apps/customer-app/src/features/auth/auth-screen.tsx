import { cn } from '@repo/native-ui/cn';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { router, Stack, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { z } from 'zod';

import { env } from '@/env';
import { errorMessage } from './request';

export function ScreenShell({
  title,
  children,
  login = false,
  header,
  contentClassName,
  headerRight,
}: {
  title: string;
  children: ReactNode;
  login?: boolean;
  header?: ReactNode;
  contentClassName?: string;
  headerRight?: ReactNode;
}) {
  const segments = useSegments();
  const member = segments[0] === '(member)';
  const onBack =
    !member || segments.at(-1) === 'addresses'
      ? () => {
          if (router.canGoBack()) router.back();
          else router.replace(member ? '/account' : '/login');
        }
      : undefined;
  return (
    <View className="bg-base flex-1">
      <SafeAreaView edges={member ? ['top'] : ['top', 'bottom']} style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        {header ??
          (!login && (
            <AppHeader title={title} right={headerRight} {...(onBack ? { onBack } : {})} />
          ))}
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={login ? 'grow px-6 py-8' : 'grow p-4'}
          >
            <View className={cn('w-full max-w-lg self-center gap-4', contentClassName)}>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function WebLink({ path, children }: { path: string; children: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View className="gap-2">
      <Button
        variant="ghost"
        onPress={() => {
          void Linking.openURL(new URL(path, env.EXPO_PUBLIC_WEB_URL).href).catch(() =>
            setFailed(true),
          );
        }}
      >
        {children}
      </Button>
      {failed && (
        <NoticeBanner tone="danger" accessibilityRole="alert">
          ブラウザを開けませんでした。端末の設定を確認してください。
        </NoticeBanner>
      )}
    </View>
  );
}

const fieldMessages: Record<string, string> = {
  name: '氏名を100文字以内で入力してください。',
  email: 'メールアドレスを確認してください。',
  password: 'パスワードを入力してください（登録時は8〜128文字）。',
  phoneNumber: '電話番号を数字10〜15桁で入力してください。',
  termsAccepted: '利用規約への同意が必要です。',
  privacyAccepted: 'プライバシーポリシーへの同意が必要です。',
};
export function useAuthAction() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  async function run<T>(schema: z.ZodType<T>, values: unknown, action: (data: T) => Promise<void>) {
    if (locked.current) return;
    setError(undefined);
    setFields({});
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFields(
        Object.fromEntries(
          parsed.error.issues.map((issue) => {
            const field = String(issue.path[0] ?? '');
            return [field, fieldMessages[field] ?? '入力内容を確認してください。'];
          }),
        ),
      );
      setError('入力内容を確認してください。');
      return;
    }
    locked.current = true;
    setPending(true);
    try {
      await action(parsed.data);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return { pending, error, fields, run };
}
export function FormError({ message }: { message: string | undefined }) {
  return message ? (
    <NoticeBanner tone="danger" accessibilityRole="alert">
      {message}
    </NoticeBanner>
  ) : null;
}
