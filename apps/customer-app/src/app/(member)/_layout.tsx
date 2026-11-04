import { TabBar } from '@repo/native-ui/tab-bar';
import { router, Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MemberLayout() {
  const path = usePathname();
  return (
    <View className="bg-base flex-1">
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <SafeAreaView edges={['bottom']}>
        {path !== '/checkout' && (
          <TabBar
            app="customer"
            value={
              path === '/account' || path === '/addresses'
                ? 'account'
                : path === '/orders'
                  ? 'orders'
                  : 'home'
            }
            onValueChange={(value) =>
              router.replace(
                value === 'account' ? '/account' : value === 'orders' ? '/orders' : '/',
              )
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
