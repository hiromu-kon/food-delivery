import { defaultCartDeliveryFee } from '@repo/domain';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Icon } from '@repo/native-ui/icon';
import { Check, ChevronDown, MapPin } from 'lucide-react-native';
import { Text } from '@repo/native-ui/text';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { createStoreSearchTransport } from '@/api/stores';
import { BottomSheet } from '@/components/sheet/bottom-sheet';
import { StoreCard } from '@/components/store/store-card';
import { ScreenShell, FormError } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { StoreSearchController } from './store-search';

export function StoreSearchScreen() {
  const [choosing, setChoosing] = useState(false);
  const { controller: session } = useSession();
  const controller = useMemo(
    () => new StoreSearchController(createStoreSearchTransport(session), session),
    [session],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => controller.connect(), [controller]);
  useFocusEffect(
    useCallback(() => {
      controller.setFocused(true);
      return () => controller.setFocused(false);
    }, [controller]),
  );
  const selected = state.addresses.find((item) => item.id === state.selectedId);
  const label = (address: typeof selected) =>
    address ? [address.address, address.building].filter(Boolean).join(' ') : '';
  return (
    <ScreenShell
      title="配達できるお店"
      contentClassName="gap-6"
      header={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="お届け先を切り替える"
          onPress={() => setChoosing(true)}
          className="border-default min-h-16 flex-row items-center gap-3 border-b px-4 py-2"
        >
          <Icon as={MapPin} className="text-brand" aria-hidden />
          <View className="min-w-0 flex-1">
            <Text variant="body-s" className="text-secondary">
              お届け先
            </Text>
            <Text variant="label-l">{label(selected) || 'お届け先を選択'}</Text>
          </View>
          <Icon as={ChevronDown} aria-hidden />
        </Pressable>
      }
    >
      <BottomSheet open={choosing} onOpenChange={setChoosing} title="お届け先を選ぶ">
        <View>
          {state.addresses.map((address) => (
            <Pressable
              key={address.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: address.id === state.selectedId }}
              accessibilityLabel={label(address)}
              onPress={() => {
                setChoosing(false);
                void controller.select(address.id);
              }}
              className="border-default min-h-[58px] flex-row items-center gap-3 border-b py-3"
            >
              <Icon as={MapPin} className="text-secondary" aria-hidden />
              <Text className="flex-1">{label(address)}</Text>
              {address.id === state.selectedId && (
                <Icon as={Check} className="text-brand" aria-hidden />
              )}
            </Pressable>
          ))}
        </View>
        <Button
          variant="secondary"
          onPress={() => {
            setChoosing(false);
            router.push('/addresses');
          }}
        >
          お届け先を追加する
        </Button>
      </BottomSheet>
      {state.status === 'loading' && (
        <ActivityIndicator accessibilityLabel="お届け先と店舗を読み込み中" />
      )}
      <FormError message={state.error} />
      {state.status === 'error' && (
        <Button
          onPress={() => {
            void controller.reload();
          }}
        >
          再試行する
        </Button>
      )}
      {state.status === 'ready' &&
        (state.addresses.length === 0 ? (
          <View className="gap-4">
            <NoticeBanner>お届け先を登録すると、配達エリア内のお店を探せます。</NoticeBanner>
            <Button variant="secondary" onPress={() => router.push('/addresses')}>
              お届け先を追加する
            </Button>
          </View>
        ) : state.stores.length === 0 ? (
          <NoticeBanner>
            このお届け先に配達できるお店はまだありません。別のお届け先もお試しください。
          </NoticeBanner>
        ) : (
          <>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="heading-l">配達できるお店</Text>
              <Text className="text-secondary">{state.stores.length} 店</Text>
            </View>
            {state.stores.map((store) => (
              <StoreCard
                key={store.id}
                name={store.name}
                {...(store.photoUrl ? { photoUrl: store.photoUrl } : {})}
                paused={!store.canOrder}
                deliveryFee={defaultCartDeliveryFee}
                minimumOrderAmount={store.minimumOrderAmount}
                distanceMeters={store.distanceMeters}
                disabled
                accessibilityRole="text"
              />
            ))}
            <NoticeBanner>メニューの表示・注文機能は準備中です。</NoticeBanner>
          </>
        ))}
      {state.status === 'ready' && state.addresses.length > 0 && (
        <Button
          variant="ghost"
          onPress={() => {
            void controller.reload();
          }}
        >
          最新の情報に更新する
        </Button>
      )}
    </ScreenShell>
  );
}
