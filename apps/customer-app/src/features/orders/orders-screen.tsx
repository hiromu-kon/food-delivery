import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatYen } from '@repo/domain';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { EmptyState } from '@repo/native-ui/empty-state';
import { StatusLabel } from '@repo/native-ui/status-label';
import { Text } from '@repo/native-ui/text';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Receipt } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, View } from 'react-native';
import { createOrdersTransport } from '@/api/orders';
import { OrderSteps } from '@/components/order/order-steps';
import { FormError, ScreenShell } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { OrdersController } from './orders';

const dateLabel = (value: string) => new Date(value).toLocaleString('ja-JP');
function useOrders(route?: string, enabled = true) {
  const { controller: session, state: auth } = useSession();
  const controller = useMemo(
    () => new OrdersController(createOrdersTransport(session), session, AsyncStorage),
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
      controller.setRoute(route, enabled && AppState.currentState === 'active');
      const listener = AppState.addEventListener('change', (next) =>
        controller.setRoute(route, enabled && next === 'active'),
      );
      return () => {
        listener.remove();
        controller.setRoute(undefined, false);
      };
    }, [controller, route, enabled]),
  );
  return { controller, state, authenticated: auth.status === 'authenticated' };
}
function Retry({ reload }: { reload: () => Promise<void> }) {
  return (
    <Button
      variant="secondary"
      onPress={() => {
        void reload();
      }}
    >
      再読み込みする
    </Button>
  );
}
export function OrderHistoryScreen() {
  const { controller, state, authenticated } = useOrders();
  const orders = authenticated ? state.orders : undefined;
  return (
    <ScreenShell title="注文履歴" contentClassName="gap-4">
      <FormError message={state.error} />
      {!orders && state.status !== 'error' && (
        <ActivityIndicator accessibilityLabel="注文履歴を読み込み中" />
      )}
      {state.status === 'error' && <Retry reload={controller.reload} />}
      {orders?.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="注文履歴はまだありません"
          description="注文すると、ここで注文内容と状況を確認できます。"
          action={<Button onPress={() => router.replace('/')}>お店を探す</Button>}
        />
      )}
      {orders?.map((order) => (
        <Pressable
          key={order.id}
          accessibilityRole="button"
          accessibilityLabel={`${order.storeName}、${dateLabel(order.createdAt)}の注文の詳細を開く`}
          onPress={() =>
            router.push({ pathname: '/orders/[orderId]', params: { orderId: order.id } })
          }
          className="border-default bg-base gap-3 rounded-md border p-4"
        >
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text variant="heading-m" className="shrink">
              {order.storeName}
            </Text>
            <StatusLabel status={order.status} />
          </View>
          <Text variant="body-s" className="text-secondary">
            {dateLabel(order.createdAt)}
          </Text>
          <View className="flex-row flex-wrap justify-between gap-2">
            <Text variant="label-l">{formatYen(order.total)}</Text>
            <Text className="text-brand">注文の詳細を見る</Text>
          </View>
        </Pressable>
      ))}
      {orders && orders.length > 0 && <Retry reload={controller.reload} />}
    </ScreenShell>
  );
}
export function OrderDetailScreen() {
  const { orderId: param } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = typeof param === 'string' && param ? param : undefined;
  const { controller, state, authenticated } = useOrders(orderId, Boolean(orderId));
  const order = authenticated && orderId && state.route === orderId ? state.order : undefined;
  return (
    <ScreenShell
      title="注文状況"
      contentClassName="gap-5"
      header={
        <AppHeader
          title="注文状況"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/orders');
          }}
        />
      }
    >
      <FormError
        message={!orderId ? '注文が見つかりません。注文履歴から選び直してください。' : state.error}
      />
      {orderId && !order && state.status !== 'error' && (
        <ActivityIndicator accessibilityLabel="注文状況を読み込み中" />
      )}
      {orderId && state.status === 'error' && <Retry reload={controller.reload} />}
      {order && (
        <>
          <Text variant="heading-m">{order.storeName}</Text>
          <StatusLabel status={order.status} />
          <OrderSteps status={order.status} />
          {state.cancellationMessage && (
            <Text accessibilityRole="alert">{state.cancellationMessage}</Text>
          )}
          {(order.status === 'pending' ||
            state.cancellation === 'uncertain' ||
            state.cancellation === 'submitting') &&
            state.cancellation !== 'blocked' && (
              <Button
                variant="secondary"
                disabled={state.cancellation === 'submitting'}
                onPress={() => {
                  Alert.alert(
                    state.cancellation === 'uncertain'
                      ? '取消結果を再確認しますか？'
                      : '注文を取り消しますか？',
                    state.cancellation === 'uncertain'
                      ? '同じ注文の取消を再試行し、仮売上の取消結果を確認します。'
                      : '店舗が受け付ける前の注文だけ取り消せます。',
                    [
                      { text: '戻る', style: 'cancel' },
                      {
                        text: '取り消す',
                        style: 'destructive',
                        onPress: () => {
                          void controller.cancel(order.id);
                        },
                      },
                    ],
                  );
                }}
              >
                {state.cancellation === 'submitting'
                  ? '取消を確認中…'
                  : state.cancellation === 'uncertain'
                    ? '取消を再試行する'
                    : '取り消す'}
              </Button>
            )}
          <Text variant="body-s" className="text-secondary">
            画面を開いている間、注文状況を自動で更新します。
          </Text>
          <Text variant="body-s">注文日時：{dateLabel(order.createdAt)}</Text>
          <Text selectable variant="body-s">
            注文番号：{order.id}
          </Text>
          <View className="border-default gap-2 border-t pt-5">
            <Text variant="heading-m">お届け先</Text>
            <Text>{[order.address, order.building].filter(Boolean).join(' ')}</Text>
            <Text>{order.fulfillment === 'hand_delivery' ? '手渡し' : '置き配'}</Text>
            {order.dropoffLocation && (
              <Text>
                置き場所：
                {
                  { front_door: '玄関前', delivery_box: '宅配ボックス', other: 'その他' }[
                    order.dropoffLocation
                  ]
                }
              </Text>
            )}
          </View>
          {order.fulfillment === 'leave_at_door' &&
            order.status === 'delivered' &&
            order.deliveryPhotoUrl && (
              <View className="gap-2">
                <Text variant="heading-m">置いた場所の写真</Text>
                <Image
                  source={{ uri: order.deliveryPhotoUrl }}
                  accessibilityLabel="配達員が撮影した置き場所"
                  className="h-60 w-full rounded-lg"
                  resizeMode="contain"
                />
              </View>
            )}
          <View className="border-default gap-3 border-t pt-5">
            <Text variant="heading-m">注文内容</Text>
            {order.items.map((item) => (
              <View key={item.menuItemId} className="flex-row justify-between gap-3">
                <Text className="flex-1">
                  {item.name} × {item.quantity}
                </Text>
                <Text>{formatYen(item.unitPrice * item.quantity)}</Text>
              </View>
            ))}
            <View className="flex-row justify-between gap-3">
              <Text>小計</Text>
              <Text>{formatYen(order.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between gap-3">
              <Text>配達料</Text>
              <Text>{formatYen(order.deliveryFee)}</Text>
            </View>
            <View className="border-default flex-row justify-between gap-3 border-t pt-3">
              <Text variant="label-l">合計</Text>
              <Text variant="heading-m">{formatYen(order.total)}</Text>
            </View>
          </View>
        </>
      )}
      <Button variant="secondary" onPress={() => router.replace('/orders')}>
        注文履歴へ
      </Button>
    </ScreenShell>
  );
}
