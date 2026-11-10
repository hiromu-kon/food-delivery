import { defaultCartDeliveryFee, formatYen, calculateCartTotals } from '@repo/domain';
import { AlertDialog } from '@repo/native-ui/alert-dialog';
import { CartBar } from '@/components/cart/cart-bar';
import { useCart } from '@/features/cart/cart-provider';
import type { CartProduct, CartStore } from '@/features/cart/cart';
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
  const { state: cart, controller: cartController } = useCart();
  const [pending, setPending] = useState<{ store: CartStore; product: CartProduct }>();
  const totals = calculateCartTotals(cart.cart);
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
      footer={
        cart.ready &&
        totals.status === 'ok' && (
          <CartBar
            count={cart.cart.reduce((sum, item) => sum + item.quantity, 0)}
            subtotal={totals.subtotal}
            onPress={() => router.push('/cart')}
          />
        )
      }
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
      <FormError message={cart.error} />
      {!cart.ready && !cart.busy && (
        <Button
          onPress={() => {
            void cartController.restore();
          }}
        >
          カートを再読み込みする
        </Button>
      )}
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
        title="カートを入れ替えますか？"
        description={`カートには${cart.store?.name ?? '別のお店'}の商品が入っています。今の商品を空にして、新しいお店の商品を入れます。`}
        actionLabel="入れ替える"
        cancelLabel="キャンセル"
        loading={cart.busy}
        onAction={() => {
          if (pending) {
            void cartController
              .add(pending.store, pending.product, true)
              .then(() => setPending(undefined));
          }
        }}
      />
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
                            disabled={
                              !cart.ready ||
                              cart.busy ||
                              !menu.store.isAcceptingOrders ||
                              (cart.cart.find(
                                (entry) =>
                                  entry.restaurantId === menu.store.id &&
                                  entry.productId === item.id,
                              )?.quantity ?? 0) >= 20
                            }
                            onAdd={() => {
                              if (item.soldout || !menu.store.isAcceptingOrders) return;
                              const store = {
                                id: menu.store.id,
                                name: menu.store.name,
                                minimumOrderAmount: menu.store.minimumOrderAmount,
                              };
                              void cartController.add(store, item).then((result) => {
                                if (result === 'confirmation-required')
                                  setPending({ store, product: item });
                              });
                            }}
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
