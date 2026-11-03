import { emailSchema } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { router } from 'expo-router';
import { useState } from 'react';

import { apiClient } from '@/api/client';
import { ScreenShell, FormError, useAuthAction } from '@/features/auth/auth-screen';
import { assertAuthSuccess } from '@/features/auth/request';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const form = useAuthAction();
  return (
    <ScreenShell title="パスワード再設定">
      <Text>
        登録したメールアドレスを入力してください。メールのリンクからブラウザで新しいパスワードを設定し、アプリに戻ってログインしてください。
      </Text>
      <FormError message={form.error} />
      {sent && (
        <NoticeBanner>
          登録がある場合、再設定メールを送りました。迷惑メールのフォルダも確認してください。リンクの有効期限は30分です。
        </NoticeBanner>
      )}
      <TextField
        label="メールアドレス"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        maxLength={254}
        errorMessage={form.fields.email ?? ''}
        editable={!form.pending}
      />
      <Button
        loading={form.pending}
        onPress={() => {
          void form.run(emailSchema, { email }, async (data) => {
            await assertAuthSuccess(
              await apiClient.auth['request-password-reset'].$post({ json: data }),
            );
            setSent(true);
          });
        }}
      >
        {sent ? '再設定メールを送り直す' : '再設定メールを送る'}
      </Button>
      <Button variant="ghost" onPress={() => router.replace('/login')}>
        ログイン画面へ戻る
      </Button>
    </ScreenShell>
  );
}
