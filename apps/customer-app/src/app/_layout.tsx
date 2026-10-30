import { useAppFonts } from '@repo/native-ui/fonts';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '../global.css';

// 認証状態による画面の出し分けはページごとではなくこの layout に置く（画面追加時の検査漏れを防ぐ）。
export default function RootLayout() {
  // 書体を読み込む前に描くと、端末の書体で一度描いてから切り替わるため、読み込むまで待つ
  const [fontsLoaded, fontError] = useAppFonts();
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <Stack />
      <StatusBar style="auto" />
      <PortalHost />
    </>
  );
}
