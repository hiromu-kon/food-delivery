import { defaultCartDeliveryFee } from '@repo/domain';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/native-ui/select';
import { Text } from '@repo/native-ui/text';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { createStoreSearchTransport } from '@/api/stores';
import { StoreCard } from '@/components/store/store-card';
import { AuthScreen, FormError } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { StoreSearchController } from './store-search';

export function StoreSearchScreen() {
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
    <AuthScreen title="お届け先に届くお店">
      {state.addresses.length > 0 && (
        <View className="gap-2">
          <Text variant="label-m">お届け先</Text>
          <Select
            value={selected ? { value: selected.id, label: label(selected) } : undefined}
            onValueChange={(option) => {
              if (option) void controller.select(option.value);
            }}
          >
            <SelectTrigger accessibilityLabel="お届け先を切り替える">
              <SelectValue placeholder="お届け先を選択" />
            </SelectTrigger>
            <SelectContent>
              {state.addresses.map((address) => (
                <SelectItem key={address.id} value={address.id} label={label(address)} />
              ))}
            </SelectContent>
          </Select>
        </View>
      )}
      <Button variant="secondary" onPress={() => router.push('/addresses')}>
        お届け先を登録・編集する
      </Button>
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
          <NoticeBanner>お届け先を登録すると、配達エリア内のお店を探せます。</NoticeBanner>
        ) : state.stores.length === 0 ? (
          <NoticeBanner>
            このお届け先に配達できるお店はまだありません。別のお届け先もお試しください。
          </NoticeBanner>
        ) : (
          <>
            <Text variant="heading-m">配達エリア内のお店（{state.stores.length}件）</Text>
            <NoticeBanner>メニューの表示・注文機能は準備中です。</NoticeBanner>
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
    </AuthScreen>
  );
}
