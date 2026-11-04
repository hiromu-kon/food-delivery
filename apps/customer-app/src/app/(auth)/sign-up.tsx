import { signUpSchema, emailSchema } from '@repo/contract';
import { legalDocumentVersions } from '@repo/domain';
import { Button } from '@repo/native-ui/button';
import { Checkbox } from '@repo/native-ui/checkbox';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { apiClient } from '@/api/client';
import { ScreenShell, FormError, useAuthAction, WebLink } from '@/features/auth/auth-screen';
import { assertAuthSuccess } from '@/features/auth/request';

export default function SignUpScreen() {
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    termsAccepted: false,
    privacyAccepted: false,
  });
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [sent, setSent] = useState(false);
  const form = useAuthAction();
  const resend = useAuthAction();
  return (
    <ScreenShell title={registeredEmail ? 'メールを確認してください' : '会員登録'}>
      {registeredEmail ? (
        <>
          <NoticeBanner>
            登録を受け付けました。メールのリンクを開いてからログインしてください。すでに登録済みの場合は、そのパスワードでログインできます。
          </NoticeBanner>
          <Text>メールの送り先：{registeredEmail}</Text>
          <Text variant="body-s">
            メールが届かない場合は、迷惑メールのフォルダも確認してください。
          </Text>
          <FormError message={resend.error} />
          {sent && (
            <NoticeBanner>未確認のアカウントがある場合、確認メールを送りました。</NoticeBanner>
          )}
          <Button
            variant="secondary"
            loading={resend.pending}
            onPress={() => {
              void resend.run(emailSchema, { email: registeredEmail }, async (data) => {
                await assertAuthSuccess(
                  await apiClient.auth['send-verification-email'].$post({ json: data }),
                );
                setSent(true);
              });
            }}
          >
            確認メールを送り直す
          </Button>
        </>
      ) : (
        <>
          <FormError message={form.error} />
          <TextField
            label="氏名"
            helperText="配達員にお伝えします"
            value={values.name}
            onChangeText={(name) => setValues({ ...values, name })}
            autoComplete="name"
            maxLength={100}
            errorMessage={form.fields.name ?? ''}
            editable={!form.pending}
          />
          <TextField
            label="メールアドレス"
            helperText="確認のメールを送ります"
            value={values.email}
            onChangeText={(email) => setValues({ ...values, email })}
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
            value={values.password}
            onChangeText={(password) => setValues({ ...values, password })}
            secureTextEntry
            autoComplete="new-password"
            maxLength={128}
            helperText="8〜128文字で入力してください。"
            errorMessage={form.fields.password ?? ''}
            editable={!form.pending}
          />
          <TextField
            label="電話番号"
            helperText="配達のときに連絡することがあります"
            value={values.phoneNumber}
            onChangeText={(phoneNumber) => setValues({ ...values, phoneNumber })}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={32}
            errorMessage={form.fields.phoneNumber ?? ''}
            editable={!form.pending}
          />
          <View className="gap-2">
            <View className="flex-row items-center gap-3">
              <Checkbox
                checked={values.termsAccepted && values.privacyAccepted}
                onCheckedChange={(checked) =>
                  setValues({ ...values, termsAccepted: checked, privacyAccepted: checked })
                }
                disabled={form.pending}
                accessibilityLabel="利用規約とプライバシーポリシーに同意します"
              />
              <Text className="flex-1">利用規約とプライバシーポリシーに同意します</Text>
            </View>
            {(form.fields.termsAccepted || form.fields.privacyAccepted) && (
              <Text className="text-danger" variant="body-s">
                利用規約とプライバシーポリシーへの同意が必要です。
              </Text>
            )}
            <View className="flex-row flex-wrap gap-2">
              <WebLink path="/terms">利用規約</WebLink>
              <WebLink path="/privacy">プライバシーポリシー</WebLink>
            </View>
          </View>
          <Button
            loading={form.pending}
            onPress={() => {
              void form.run(
                signUpSchema,
                {
                  ...values,
                  termsVersion: legalDocumentVersions.terms,
                  privacyVersion: legalDocumentVersions.privacy,
                },
                async (data) => {
                  await assertAuthSuccess(
                    await apiClient.auth['sign-up'].email.$post({ json: data }),
                  );
                  setRegisteredEmail(data.email);
                  setValues({
                    name: '',
                    email: '',
                    password: '',
                    phoneNumber: '',
                    termsAccepted: false,
                    privacyAccepted: false,
                  });
                },
              );
            }}
          >
            登録する
          </Button>
        </>
      )}
      <Button variant="ghost" onPress={() => router.replace('/login')}>
        ログイン画面へ
      </Button>
    </ScreenShell>
  );
}
