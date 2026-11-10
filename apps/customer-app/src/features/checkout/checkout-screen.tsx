import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeliveryAddress } from '@repo/contract';
import { calculateCartTotals, formatYen } from '@repo/domain';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { createAddressTransport } from '@/api/addresses';
import { createOrderTransport } from '@/api/orders';
import { AuthRequestError } from '@/features/auth/request';
import { ScreenShell, FormError } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { useCart } from '@/features/cart/cart-provider';
import {
  attemptSchema,
  matchesOrderCart,
  CheckoutController,
  type Attempt,
  type CheckoutForm,
} from './checkout';
import { PaymentCard, PaymentProvider, stripeTestKey, usePaymentMethod } from './payment';

const attemptPrefix = 'customer.checkout.attempt.v1';
export function CheckoutScreen() {
  const { state: auth } = useSession();
  const [owner, setOwner] = useState(() =>
    auth.status === 'authenticated' ? auth.user.id : undefined,
  );
  if (auth.status === 'authenticated' && owner !== auth.user.id) setOwner(auth.user.id);
  if (!owner) return <ActivityIndicator accessibilityLabel="認証を確認中" />;
  return <RestoreCheckout key={owner} attemptKey={`${attemptPrefix}.${owner}`} />;
}
function RestoreCheckout({ attemptKey }: { attemptKey: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>();
  const [error, setError] = useState<string>();
  const restore = useCallback(() => {
    void AsyncStorage.getItem(attemptKey)
      .then((raw) => {
        // This app writes only opaque Stripe IDs, never card details.
        setAttempt(raw ? attemptSchema.parse(JSON.parse(raw)) : null);
      })
      .catch(() => setError('注文の送信状況を読み込めません。再試行してください。'));
  }, [attemptKey]);
  useEffect(restore, [restore]);
  if (attempt === undefined)
    return (
      <ScreenShell title="注文の確認">
        <FormError message={error} />
        {error ? (
          <Button onPress={restore}>再試行する</Button>
        ) : (
          <ActivityIndicator accessibilityLabel="注文状況を確認中" />
        )}
      </ScreenShell>
    );
  return (
    <PaymentProvider>
      <CheckoutContent attempt={attempt} attemptKey={attemptKey} />
    </PaymentProvider>
  );
}
function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className={`border-default min-h-11 justify-center rounded-sm border px-4 py-3 ${selected ? 'bg-brand-subtle' : 'bg-base'}`}
    >
      <Text variant="label-l">
        {selected ? '● ' : '○ '}
        {label}
      </Text>
    </Pressable>
  );
}
function CheckoutContent({ attempt, attemptKey }: { attempt: Attempt | null; attemptKey: string }) {
  const { state: cart, controller: cartController } = useCart();
  const { controller: session, state: auth } = useSession();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addressError, setAddressError] = useState<string>();
  const [form, setForm] = useState<CheckoutForm>({
    addressId: attempt?.request.addressId ?? '',
    fulfillment: attempt?.request.fulfillment ?? 'hand_delivery',
    dropoffLocation: attempt?.request.dropoffLocation ?? '',
    deliveryNote: attempt?.request.deliveryNote ?? '',
  });
  const [cardComplete, setCardComplete] = useState(false);
  const paymentMethod = usePaymentMethod(cardComplete);
  const [controller] = useState(
    () =>
      new CheckoutController(
        {
          uuid: randomUUID,
          paymentMethod,
          submit: createOrderTransport(session),
          save: async (value) => {
            if (value) await AsyncStorage.setItem(attemptKey, JSON.stringify(value));
            else await AsyncStorage.removeItem(attemptKey);
          },
          clearCart: async (request) => {
            const current = cartController.getSnapshot();
            if (!current.ready || current.busy)
              throw new AuthRequestError(
                '注文は受付済みですが、カートの更新を待っています。同じ注文で再試行してください。',
              );
            if (matchesOrderCart(current, request)) await cartController.clear();
          },
        },
        attempt,
      ),
  );
  useEffect(() => controller.setPaymentMethod(paymentMethod), [controller, paymentMethod]);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useFocusEffect(
    useCallback(() => {
      if (auth.status !== 'authenticated') return;
      let active = true;
      setLoading(true);
      setAddressError(undefined);
      void createAddressTransport(session)
        .list()
        .then((list) => {
          if (!active) return;
          setAddresses(list);
          setForm((current) => {
            if (current.addressId) return current;
            const address = list.find((item) => item.isDefault) ?? list[0];
            return {
              ...current,
              addressId: address?.id ?? '',
              deliveryNote: address?.deliveryNote ?? '',
            };
          });
        })
        .catch(() => {
          if (active) setAddressError('お届け先を読み込めません。画面を開き直してください。');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [session, auth.status]),
  );
  const locked = state.pending || Boolean(state.attempt);
  const sameCart = !state.attempt || matchesOrderCart(cart, state.attempt.request);
  const reviewItems = state.attempt
    ? state.attempt.request.items.map((item) => ({
        productId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: sameCart
          ? cart.cart.find((entry) => entry.productId === item.menuItemId)?.unitPrice
          : undefined,
      }))
    : cart.cart;
  const totals = sameCart ? calculateCartTotals(cart.cart) : undefined;
  if (state.order)
    return (
      <ScreenShell title="注文の確認">
        <Text variant="heading-m" accessibilityRole="alert">
          注文を受け付けました
        </Text>
        <Text selectable>注文番号：{state.order.id}</Text>
        <Text>お店の受付をお待ちください。</Text>
        <Button onPress={() => router.replace('/')}>お店を探す</Button>
      </ScreenShell>
    );
  return (
    <ScreenShell
      title="注文の確認"
      contentClassName="gap-5"
      header={
        <AppHeader
          title="注文の確認"
          {...(!state.pending ? { onBack: () => router.back() } : {})}
        />
      }
      footer={
        <View className="gap-2">
          <FormError message={state.error} />
          {state.rejected && (
            <Button
              disabled={state.pending}
              variant="secondary"
              onPress={() => {
                setCardComplete(false);
                void controller.resetRejected();
              }}
            >
              注文の失敗を確認し、内容を変更する
            </Button>
          )}
          <View className="flex-row justify-between">
            <Text variant="label-l">お支払い金額（目安）</Text>
            <Text variant="heading-m">
              {totals?.status === 'ok' ? formatYen(totals.total) : '—'}
            </Text>
          </View>
          <Button
            loading={state.pending}
            disabled={
              Boolean(state.rejected) ||
              loading ||
              (!state.attempt && (!stripeTestKey || !cart.ready || cart.busy))
            }
            onPress={() => {
              void controller.submit(cart, addresses, form);
            }}
          >
            {state.attempt ? '同じ注文で再試行する' : '注文を確定する'}
          </Button>
        </View>
      }
    >
      <FormError message={addressError} />
      {state.attempt && !state.rejected && (
        <NoticeBanner>
          送信済みの注文結果を確認します。重複注文を防ぐため、同じ内容で再試行してください。
        </NoticeBanner>
      )}
      {!cart.cart.length && !state.attempt && (
        <NoticeBanner>カートは空です。商品を追加してください。</NoticeBanner>
      )}
      <Text variant="heading-m">お届け先</Text>
      {loading && <ActivityIndicator accessibilityLabel="お届け先を読み込み中" />}
      {addresses.map((address) => (
        <Choice
          key={address.id}
          label={[address.label, address.address, address.building].filter(Boolean).join(' ')}
          selected={form.addressId === address.id}
          disabled={locked}
          onPress={() =>
            setForm({ ...form, addressId: address.id, deliveryNote: address.deliveryNote })
          }
        />
      ))}
      {!loading && addresses.length === 0 && (
        <NoticeBanner>注文するにはお届け先の登録が必要です。</NoticeBanner>
      )}
      <Button variant="ghost" disabled={locked} onPress={() => router.push('/addresses')}>
        お届け先を登録・変更する
      </Button>
      <View className="border-default gap-3 border-t pt-5">
        <Text variant="heading-m">受け取り方法</Text>
        <View className="flex-row gap-3">
          <Choice
            label="手渡し"
            selected={form.fulfillment === 'hand_delivery'}
            disabled={locked}
            onPress={() => setForm({ ...form, fulfillment: 'hand_delivery' })}
          />
          <Choice
            label="置き配"
            selected={form.fulfillment === 'leave_at_door'}
            disabled={locked}
            onPress={() => setForm({ ...form, fulfillment: 'leave_at_door' })}
          />
        </View>
        {form.fulfillment === 'leave_at_door' && (
          <>
            <Text variant="label-l">置き場所（必須）</Text>
            {(
              [
                ['front_door', '玄関前'],
                ['delivery_box', '宅配ボックス'],
                ['other', 'その他'],
              ] as const
            ).map(([value, label]) => (
              <Choice
                key={value}
                label={label}
                selected={form.dropoffLocation === value}
                disabled={locked}
                onPress={() => setForm({ ...form, dropoffLocation: value })}
              />
            ))}
          </>
        )}
        <TextField
          label="配達メモ"
          helperText={`${form.deliveryNote.length}/100文字（${form.fulfillment === 'leave_at_door' && form.dropoffLocation === 'other' ? '置き場所の詳細を入力・必須' : '任意'}）`}
          multiline
          maxLength={100}
          editable={!locked}
          value={form.deliveryNote}
          onChangeText={(deliveryNote) => setForm({ ...form, deliveryNote })}
        />
      </View>
      <View className="border-default gap-3 border-t pt-5">
        <Text variant="heading-m">注文内容</Text>
        <Text variant="label-l">{sameCart ? cart.store?.name : '送信済みの注文'}</Text>
        {reviewItems.map((item) => (
          <View key={item.productId} className="flex-row justify-between gap-3">
            <Text className="flex-1">
              {cart.details.find((detail) => detail.productId === item.productId)?.name ?? '商品'} ×{' '}
              {item.quantity}
            </Text>
            <Text>
              {item.unitPrice === undefined ? '—' : formatYen(item.unitPrice * item.quantity)}
            </Text>
          </View>
        ))}
        {totals?.status === 'ok' && (
          <>
            <View className="flex-row justify-between">
              <Text>小計</Text>
              <Text>{formatYen(totals.subtotal)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text>配達料</Text>
              <Text>{formatYen(totals.deliveryFee)}</Text>
            </View>
          </>
        )}
        <Text variant="body-s" className="text-secondary">
          金額・在庫・配達範囲は注文時に確認します。
        </Text>
      </View>
      <View className="border-default gap-3 border-t pt-5">
        <Text variant="heading-m">お支払い</Text>
        {stripeTestKey ? (
          <PaymentCard
            key={state.attempt?.key ?? 'new'}
            disabled={locked}
            onComplete={setCardComplete}
          />
        ) : (
          <NoticeBanner>テスト決済が設定されていないため、注文できません。</NoticeBanner>
        )}
        <Text variant="body-s" className="text-secondary">
          カード情報は決済会社が管理し、このサービスには保存しません。
        </Text>
      </View>
    </ScreenShell>
  );
}
