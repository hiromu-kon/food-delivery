import { defaultCartDeliveryFee, formatYen } from '@repo/domain';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Tabs } from '@repo/native-ui/tabs';
import { Text } from '@repo/native-ui/text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { createMenuTransport } from '@/api/menu';
import { FoodPhoto } from '@/components/store/food-photo';
import { MenuItem } from '@/components/store/menu-item';
import { StoreNoren } from '@/components/store/store-noren';
import { FormError, ScreenShell } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { MenuController } from './menu';

export function MenuScreen() {
  const { storeId: param } = useLocalSearchParams<{ storeId?: string | string[] }>();
  const storeId = typeof param === 'string' ? param : undefined;
  const { controller: session } = useSession();
  const controller = useMemo(
    () => new MenuController(createMenuTransport(session), session),
    [session],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [selection, setSelection] = useState<{ storeId: string; categoryId: string }>();
  useEffect(() => controller.connect(), [controller]);
  useFocusEffect(
    useCallback(() => {
      controller.setRoute(storeId, true);
      return () => controller.setRoute(undefined, false);
    }, [controller, storeId]),
  );
  // Route changes render before focus effects run; never paint the preceding store in that frame.
  const menu = state.storeId === storeId ? state.menu : undefined;
  const selectedId =
    selection &&
    selection.storeId === storeId &&
    menu?.categories.some((c) => c.id === selection.categoryId)
      ? selection.categoryId
      : (menu?.categories[0]?.id ?? '');
  return (
    <ScreenShell
      title="店舗のメニュー"
      contentClassName="gap-6"
      header={
        <AppHeader
          title="店舗のメニュー"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
      }
    >
      {(!storeId || (state.storeId === storeId && state.status === 'error')) && (
        <FormError
          message={
            storeId ? state.error : '店舗が見つかりません。お店の一覧から選び直してください。'
          }
        />
      )}
      {storeId && !menu && state.status !== 'error' && (
        <ActivityIndicator accessibilityLabel="メニューを読み込み中" />
      )}
      {storeId && state.storeId === storeId && state.status === 'error' && (
        <Button
          onPress={() => {
            void controller.reload();
          }}
        >
          再試行する
        </Button>
      )}
      {menu && (
        <>
          <View>
            <FoodPhoto
              photoUrl={menu.store.photoUrl ?? undefined}
              label={`${menu.store.name}の料理`}
              className="-mx-4 -mt-4 h-59 rounded-none"
              iconClassName="size-10"
            />
            <StoreNoren
              name={menu.store.name}
              description={menu.store.description}
              className="-mt-15"
            />
          </View>
          <View className="flex-row flex-wrap gap-8 px-2">
            {[
              ['配達料', formatYen(defaultCartDeliveryFee)],
              ['最低注文', formatYen(menu.store.minimumOrderAmount)],
              ['受付', menu.store.isAcceptingOrders ? '受付中' : '受付停止中'],
            ].map(([label, value]) => (
              <View key={label} className="gap-1">
                <Text variant="body-s" className="text-secondary">
                  {label}
                </Text>
                <Text variant="label-l">{value}</Text>
              </View>
            ))}
          </View>
          <Text variant="body-s" className="text-secondary">
            {menu.store.address}
          </Text>
          {!menu.store.isAcceptingOrders && (
            <NoticeBanner>現在、このお店は注文の受付を停止しています。</NoticeBanner>
          )}
          {menu.categories.length === 0 ? (
            <NoticeBanner>メニューはまだ登録されていません。</NoticeBanner>
          ) : (
            <Tabs
              value={selectedId}
              onValueChange={(categoryId) => {
                if (storeId) setSelection({ storeId, categoryId });
              }}
              items={menu.categories.map((category) => ({
                value: category.id,
                label: category.name,
                content: (
                  <View className="gap-2">
                    <Text variant="heading-m" role="heading">
                      {category.name}
                    </Text>
                    {category.description !== '' && (
                      <Text variant="body-s" className="text-secondary">
                        {category.description}
                      </Text>
                    )}
                    {category.photoUrl && (
                      <FoodPhoto
                        photoUrl={category.photoUrl}
                        label={`${category.name}の写真`}
                        className="h-24 w-full"
                      />
                    )}
                    {category.items.length === 0 ? (
                      <NoticeBanner>このカテゴリの商品はまだ登録されていません。</NoticeBanner>
                    ) : (
                      <View>
                        {category.items.map((item) => (
                          <MenuItem
                            key={item.id}
                            name={item.name}
                            description={item.description}
                            price={item.price}
                            soldOut={item.soldout}
                            {...(item.photoUrl ? { photoUrl: item.photoUrl } : {})}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ),
              }))}
            />
          )}
        </>
      )}
    </ScreenShell>
  );
}
