import { Button } from '@repo/native-ui/button';
import { useAppFonts } from '@repo/native-ui/fonts';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { ToastProvider } from '@repo/native-ui/toast';
import { PortalHost } from '@rn-primitives/portal';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/features/auth/session-provider';
import { CartProvider } from '@/features/cart/cart-provider';
import '../global.css';

function SessionRoutes() {
  const { state, controller } = useSession();
  const pathname = usePathname();
  useEffect(() => {
    void controller.refresh();
  }, [pathname, controller]);
  const blocked = state.status === 'loading' || state.status === 'error';
  const authenticated =
    state.status === 'authenticated' ||
    (state.status === 'loading' && state.authenticated === true);
  return (
    <View className="bg-base flex-1">
      <View
        className="flex-1"
        pointerEvents={blocked ? 'none' : 'auto'}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={authenticated} redirectTo="/login">
            <Stack.Screen name="(member)" />
            <Stack.Screen name="dev" />
          </Stack.Protected>
          <Stack.Protected guard={!authenticated} redirectTo="/">
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      </View>
      {blocked && (
        <View className="bg-base absolute inset-0" accessibilityViewIsModal>
          <SafeAreaView style={{ flex: 1 }}>
            <View className="flex-1 justify-center gap-6 px-6">
              {state.status === 'loading' ? (
                <>
                  <ActivityIndicator accessibilityLabel="認証を確認中" />
                  <Text className="text-center">ログイン状態を確認しています…</Text>
                </>
              ) : (
                state.status === 'error' && (
                  <>
                    <NoticeBanner tone="danger" accessibilityRole="alert">
                      {state.message}
                    </NoticeBanner>
                    <Button
                      onPress={() => {
                        void (state.retry === 'logout'
                          ? controller.logout()
                          : controller.restore());
                      }}
                    >
                      再試行する
                    </Button>
                    {state.retry === 'restore' && (
                      <Button
                        variant="secondary"
                        onPress={() => {
                          void controller.logout();
                        }}
                      >
                        端末のログイン情報を削除する
                      </Button>
                    )}
                  </>
                )
              )}
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <SessionProvider>
          <CartProvider>
            <SessionRoutes />
          </CartProvider>
          <StatusBar style="auto" />
          <PortalHost />
        </SessionProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
