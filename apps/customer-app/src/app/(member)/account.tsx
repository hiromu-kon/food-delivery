import { Icon } from '@repo/native-ui/icon';
import { ListItem } from '@repo/native-ui/list-item';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { FileText, LogOut, MapPin, Shield, User } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { createAddressTransport } from '@/api/addresses';
import { env } from '@/env';
import { ScreenShell } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';

export default function AccountScreen() {
  const { state, controller } = useSession();
  const [preference, setPreference] = useState<{ userId: string; label: string }>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPreference(undefined);
      if (state.status === 'authenticated') {
        void createAddressTransport(controller)
          .list()
          .then(
            (addresses) => {
              if (active)
                setPreference({
                  userId: state.user.id,
                  label: addresses.find((address) => address.isDefault)?.label ?? '',
                });
            },
            () => {
              if (active) setPreference(undefined);
            },
          );
      }
      return () => {
        active = false;
      };
    }, [controller, state]),
  );
  const [linkError, setLinkError] = useState(false);
  const openLegal = (path: string) => {
    setLinkError(false);
    void Linking.openURL(new URL(path, env.EXPO_PUBLIC_WEB_URL).href).catch(() =>
      setLinkError(true),
    );
  };
  if (state.status !== 'authenticated') return null;
  const defaultLabel = preference?.userId === state.user.id ? preference.label : '';
  return (
    <ScreenShell title="アカウント" contentClassName="gap-5">
      <View className="flex-row items-center gap-4">
        <View className="bg-subtle size-14 items-center justify-center rounded-full">
          <Icon as={User} className="text-secondary size-7" aria-hidden />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="heading-m" selectable>
            {state.user.name}
          </Text>
          <Text variant="body-s" className="text-secondary" selectable>
            {state.user.email}
          </Text>
          <Text variant="body-s" className="text-secondary" selectable>
            {state.user.phoneNumber}
          </Text>
          {!state.user.emailVerified && <Text variant="body-s">メール未確認</Text>}
        </View>
      </View>
      <View>
        <ListItem
          title="お届け先"
          icon={MapPin}
          trailing={
            defaultLabel ? (
              <Text className="text-secondary max-w-[50%] shrink">{defaultLabel}</Text>
            ) : undefined
          }
          onPress={() => router.push('/addresses')}
        />
        <ListItem title="利用規約" icon={FileText} onPress={() => openLegal('/terms')} />
        <ListItem
          title="プライバシーポリシー"
          icon={Shield}
          onPress={() => openLegal('/privacy')}
        />
        <ListItem
          title="ログアウト"
          icon={LogOut}
          chevron={false}
          onPress={() => {
            void controller.logout();
          }}
        />
      </View>
      {linkError && (
        <NoticeBanner tone="danger" accessibilityRole="alert">
          ブラウザを開けませんでした。端末の設定を確認してください。
        </NoticeBanner>
      )}
      <Text variant="body-s" className="text-secondary">
        登録情報を変えるとき、退会するときは、お問い合わせ窓口に連絡してください。
      </Text>
    </ScreenShell>
  );
}
