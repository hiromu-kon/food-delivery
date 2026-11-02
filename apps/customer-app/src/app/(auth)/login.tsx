import { signInSchema, emailSchema } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { TextField } from '@repo/native-ui/text-field';
import { router } from 'expo-router';
import { useState } from 'react';

import { apiClient } from '@/api/client';
import { AuthScreen, FormError, useAuthAction } from '@/features/auth/auth-screen';
import { assertAuthSuccess } from '@/features/auth/request';
import { useSession } from '@/features/auth/session-provider';

export default function LoginScreen() {
  const { state, controller } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const form = useAuthAction();
  const resend = useAuthAction();
  return (
    <AuthScreen title="ログイン">
      {state.status === 'anonymous' && state.message && (
        <NoticeBanner>{state.message}</NoticeBanner>
      )}
      <FormError message={form.error} />
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
      <TextField
        label="パスワード"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        maxLength={128}
        errorMessage={form.fields.password ?? ''}
        editable={!form.pending}
      />
      <Button
        loading={form.pending}
        onPress={() => {
          void form.run(signInSchema, { email, password }, async (data) => {
            await controller.login(data);
            setPassword('');
          });
        }}
      >
        ログインする
      </Button>
      <Button variant="ghost" onPress={() => router.push('/forgot-password')}>
        パスワードを忘れた方
      </Button>
      <Button variant="secondary" onPress={() => router.push('/sign-up')}>
        会員登録する
      </Button>
      <FormError message={resend.error} />
      {sent && (
        <NoticeBanner>
          未確認のアカウントがある場合、確認メールを送りました。メールのリンクを開いてからログインしてください。
        </NoticeBanner>
      )}
      <Button
        variant="ghost"
        loading={resend.pending}
        disabled={form.pending}
        onPress={() => {
          void resend.run(emailSchema, { email }, async (data) => {
            await assertAuthSuccess(
              await apiClient.auth['send-verification-email'].$post({ json: data }),
            );
            setSent(true);
          });
        }}
      >
        確認メールを送り直す
      </Button>
    </AuthScreen>
  );
}
