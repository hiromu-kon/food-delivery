import { calculateCartTotals, checkCartOrderability, formatYen } from '@repo/domain';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { FoodPhoto } from '@/components/store/food-photo';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { FormError, ScreenShell } from '@/features/auth/auth-screen';
import { useCart } from './cart-provider';

export function CartScreen() {
  const { state, controller } = useCart();
  const totals = calculateCartTotals(state.cart);
  const orderability = checkCartOrderability(state.cart, state.store?.minimumOrderAmount);
  return (
    <ScreenShell
      footer={
        state.ready &&
        state.cart.length > 0 && (
          <View className="gap-2">
            <Button
              disabled={state.busy || orderability.status !== 'orderable'}
              onPress={() => router.push('/checkout')}
            >
              注文内容の確認へ
            </Button>
          </View>
        )
      }
      title="カート"
      header={
        <AppHeader
          title="カート"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />
      }
    >
      <FormError message={state.error} />
      {!state.ready ? (
        <>
          {state.busy ? (
            <ActivityIndicator accessibilityLabel="カートを読み込み中" />
          ) : (
            <Button
              onPress={() => {
                void controller.restore();
              }}
            >
              再試行する
            </Button>
          )}
        </>
      ) : state.cart.length === 0 ? (
        <View className="gap-6 py-8">
          <Text variant="heading-m">カートは空です</Text>
          <Text className="text-secondary">お店のメニューから、食べたいものを選んでください。</Text>
          <Button onPress={() => router.replace('/')}>お店を探す</Button>
        </View>
      ) : (
        <>
          <Text variant="label-l">{state.store?.name}</Text>
          {state.cart.map((item) => {
            const detail = state.details.find((detail) => detail.productId === item.productId);
            const name = detail?.name ?? '商品';
            return (
              <View
                key={item.productId}
                className="border-default flex-row flex-wrap items-center gap-3 border-b py-3"
              >
                <FoodPhoto
                  photoUrl={detail?.photoUrl}
                  label={`${name}の写真`}
                  className="size-16"
                />
                <View className="min-w-24 flex-1 gap-1">
                  <Text variant="body-l">{name}</Text>
                  <Text variant="label-l">{formatYen(item.unitPrice * item.quantity)}</Text>
                  <Text variant="body-s" className="text-secondary">
                    単価 {formatYen(item.unitPrice)}
                  </Text>
                </View>
                <QuantityStepper
                  itemName={name}
                  quantity={item.quantity}
                  disabled={state.busy}
                  onQuantityChange={(quantity) => {
                    void controller.setQuantity(item.productId, quantity);
                  }}
                  onRemove={() => {
                    void controller.setQuantity(item.productId, 0);
                  }}
                />
              </View>
            );
          })}
          <Button
            variant="secondary"
            onPress={() => {
              if (state.store)
                router.push({
                  pathname: '/stores/[storeId]/menu',
                  params: { storeId: state.store.id },
                });
            }}
          >
            商品を追加する
          </Button>
          {totals.status === 'ok' && (
            <View className="gap-2 py-4">
              {(
                [
                  ['小計', totals.subtotal],
                  ['配達料', totals.deliveryFee],
                  ['合計（税込）', totals.total],
                ] as const
              ).map(([label, value]) => (
                <View key={label} className="flex-row justify-between gap-4">
                  <Text variant="label-l">{label}</Text>
                  <Text variant="label-l">{formatYen(value)}</Text>
                </View>
              ))}
            </View>
          )}
          <NoticeBanner>お店が受け付けるまで、代金は請求されません。</NoticeBanner>
          {orderability.status === 'below-minimum' ? (
            <NoticeBanner>
              <Text>
                最低注文金額 {formatYen(state.store?.minimumOrderAmount ?? 0)} まで、あと{' '}
                {formatYen(orderability.shortfall)} です。配達料は含みません。
              </Text>
            </NoticeBanner>
          ) : (
            <NoticeBanner>最低注文金額を満たしています。</NoticeBanner>
          )}
        </>
      )}
    </ScreenShell>
  );
}
