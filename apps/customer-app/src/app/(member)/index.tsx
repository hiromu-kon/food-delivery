import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { router } from 'expo-router';

import { AuthScreen } from '@/features/auth/auth-screen';
export default function HomeScreen() {
  return (
    <AuthScreen title="ホーム">
      <Text>店舗の一覧は準備中です。</Text>
      <Button variant="secondary" onPress={() => router.push('/account')}>
        アカウント情報を見る
      </Button>
    </AuthScreen>
  );
}
