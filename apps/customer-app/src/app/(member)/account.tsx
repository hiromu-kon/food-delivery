import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AuthScreen, WebLink } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';

export default function AccountScreen() {
  const { state, controller } = useSession();
  if (state.status !== 'authenticated') return null;
  return (
    <AuthScreen title="アカウント">
      {[
        ['氏名', state.user.name],
        ['メールアドレス', state.user.email],
        ['メールの確認', state.user.emailVerified ? '確認済み' : '未確認'],
        ['電話番号', state.user.phoneNumber],
        ['アカウント種別', '注文者'],
      ].map(([label, value]) => (
        <View key={label} className="border-default gap-1 border-b pb-4">
          <Text variant="body-s" className="text-secondary">
            {label}
          </Text>
          <Text selectable>{value}</Text>
        </View>
      ))}
      <Button variant="secondary" onPress={() => router.push('/addresses')}>
        お届け先
      </Button>
      <WebLink path="/terms">利用規約（ブラウザ）</WebLink>
      <WebLink path="/privacy">プライバシーポリシー（ブラウザ）</WebLink>
      <Button
        variant="danger"
        onPress={() => {
          void controller.logout();
        }}
      >
        ログアウトする
      </Button>
    </AuthScreen>
  );
}
