import { useAppFonts } from '@repo/native-ui/fonts';
import { ToastProvider } from '@repo/native-ui/toast';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/features/auth/session-provider';

import '../global.css';

export default function RootLayout() {
  // 書体を読み込む前に描くと、端末の書体で一度描いてから切り替わるため、読み込むまで待つ
  const [fontsLoaded, fontError] = useAppFonts();
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <ToastProvider>
          <Stack />
          <StatusBar style="auto" />
          <PortalHost />
        </ToastProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
