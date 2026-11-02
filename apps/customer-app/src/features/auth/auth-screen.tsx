import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { z } from 'zod';

import { env } from '@/env';
import { errorMessage } from './request';

export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      className="bg-base flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="grow px-6 py-8">
        <View className="w-full max-w-lg self-center gap-6">
          <View className="gap-2">
            <Text variant="body-s" className="text-brand">
              Food Delivery
            </Text>
            <Text variant="heading-l">{title}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
