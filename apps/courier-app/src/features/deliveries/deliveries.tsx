import { DeliveryCamera } from './delivery-camera';
import type { CourierOrderDetail } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';

import {
  uploadDeliveryPhoto,
  acceptDelivery,
  completeDelivery,
  currentDelivery,
  deliveryDetail,
  listDeliveries,
  receiveDelivery,
} from '@/api/courier';
import { AuthRequestError, errorMessage } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';

type DeliveryList = Awaited<ReturnType<typeof listDeliveries>>['orders'];

export function Deliveries({
  controller,
  available,
  onFooterChange,
}: {
  controller: SessionController;
  available: boolean;
  onFooterChange: (footer: ReactNode | null) => void;
}) {
  const [orders, setOrders] = useState<DeliveryList>([]);
  const [selected, setSelected] = useState<CourierOrderDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const generation = useRef(0);
  const locked = useRef(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const current = ++generation.current;
    locked.current = true;
    void Promise.all([currentDelivery(controller), listDeliveries(controller)])
      .then(([assigned, waiting]) => {
        if (current !== generation.current) return;
        setSelected(assigned.order);
        setOrders(waiting.orders);
      })
      .catch((error: unknown) => {
        if (current === generation.current) setMessage(errorMessage(error));
      })
      .finally(() => {
        if (current === generation.current) {
          locked.current = false;
          setBusy(false);
        }
      });
    const invalidate = () => {
      generation.current++;
    };
    const listener = AppState.addEventListener('change', (state) => {
      invalidate();
      setBusy(true);
      setSelected(null);
      setOrders([]);
      if (state === 'active') setRevision((value) => value + 1);
    });
    return () => {
      invalidate();
      listener.remove();
    };
  }, [controller, available, revision]);

  function reload() {
    generation.current++;
    locked.current = true;
    setBusy(true);
    setSelected(null);
    setOrders([]);
    setRevision((value) => value + 1);
  }

  async function run(action: () => Promise<CourierOrderDetail | null>): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    const current = ++generation.current;
    setBusy(true);
    setMessage('');
    let succeeded = false;
    try {
      const order = await action();
      if (current === generation.current) {
        setSelected(order);
        if (!order) setRevision((value) => value + 1);
        succeeded = true;
      }
    } catch (error) {
      if (current !== generation.current) return false;
      setMessage(errorMessage(error));
      if (
        error instanceof AuthRequestError &&
        ['ORDER_ALREADY_ASSIGNED', 'NOT_FOUND'].includes(error.code)
      ) {
        reload();
      }
    } finally {
      if (current === generation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
    return succeeded;
  }

  useEffect(() => {
    if (
      !selected?.isAssignedToMe ||
      selected.status !== 'delivering' ||
      selected.fulfillment !== 'leave_at_door'
    ) {
      onFooterChange(null);
    }
    return () => onFooterChange(null);
  }, [onFooterChange, selected]);

  return (
    <View className="gap-4">
      <Text variant="heading-l">
        {selected ? (selected.isAssignedToMe ? '担当中の配達' : '配達の詳細') : '配達待ちの注文'}
      </Text>
      {message ? (
        <Text accessibilityRole="alert" className="text-danger">
          {message}
        </Text>
      ) : null}
      {selected ? (
        <>
          <View className="gap-2 rounded-2xl border border-default p-4">
            <Text className="text-secondary">配達状況</Text>
            <Text variant="heading-m">
              {selected.status === 'preparing'
                ? '調理中'
                : selected.status === 'ready'
                  ? '準備完了'
                  : selected.status === 'delivering'
                    ? '配達中'
                    : '配達待ちではありません'}
            </Text>
          </View>
          <View className="gap-2 rounded-2xl border border-default p-4">
            <Text className="text-secondary">お届け先</Text>
            <Text variant="heading-m">{selected.address}</Text>
            {selected.building ? <Text>{selected.building}</Text> : null}
            <Text>{selected.customerPhoneNumber ?? '電話番号未登録'}</Text>
            <Text>店舗から直線 {(selected.distanceMeters / 1000).toFixed(1)} km</Text>
          </View>
          <Text variant="heading-m">{selected.storeName}</Text>
          <Text>店舗：{selected.storeAddress}</Text>
          <View className="gap-2 rounded-2xl border border-default p-4">
            <Text className="text-secondary">注文内容</Text>
            {selected.items.map((item) => (
              <Text key={item.menuItemId}>
                {item.name} × {item.quantity}
              </Text>
            ))}
          </View>
          <View className="gap-2 rounded-2xl border border-default p-4">
            <Text className="text-secondary">お渡し方法</Text>
            <Text>{selected.fulfillment === 'hand_delivery' ? '手渡し' : '置き配'}</Text>
            {selected.dropoffLocation ? (
              <Text>
                置き場所：
                {
                  {
                    front_door: '玄関前',
                    delivery_box: '宅配ボックス',
                    other: 'その他（配達メモ）',
                  }[selected.dropoffLocation]
                }
              </Text>
            ) : null}
            <Text>配達メモ：{selected.deliveryNote || 'なし'}</Text>
          </View>
          {selected.isAssignedToMe ? (
            <>
              {selected.status === 'ready' ? (
                <Button
                  loading={busy}
                  onPress={() =>
                    void run(async () => (await receiveDelivery(controller, selected.id)).order)
                  }
                >
                  受け取った
                </Button>
              ) : null}
              {selected.status === 'delivering' && selected.fulfillment === 'leave_at_door' ? (
                <View className="gap-3">
                  {selected.hasDeliveryPhoto ? (
                    <Text>写真の送信を確認しました。配達完了にできます。</Text>
                  ) : null}
                  <DeliveryCamera
                    key={selected.id}
                    busy={busy}
                    hasUploadedPhoto={selected.hasDeliveryPhoto}
                    onUpload={async (photo) =>
                      run(
                        async () =>
                          (await uploadDeliveryPhoto(controller, selected.id, photo)).order,
                      )
                    }
                    onComplete={() => {
                      void run(async () => {
                        await completeDelivery(controller, selected.id);
                        return null;
                      });
                    }}
                    onFooterChange={onFooterChange}
                  />
                </View>
              ) : null}
              {selected.status === 'delivering' && selected.fulfillment === 'hand_delivery' ? (
                <Button
                  loading={busy}
                  onPress={() =>
                    void run(async () => {
                      await completeDelivery(controller, selected.id);
                      return null;
                    })
                  }
                >
                  渡した・配達完了
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button
                loading={busy}
                disabled={!available}
                onPress={() =>
                  void run(async () => (await acceptDelivery(controller, selected.id)).order)
                }
              >
                担当になる
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  generation.current++;
                  setSelected(null);
                }}
              >
                一覧に戻る
              </Button>
            </>
          )}
        </>
      ) : (
        <>
          {!available ? (
            <Text>稼働中に切り替えると配達待ちの注文を確認できます。</Text>
          ) : !busy && orders.length === 0 ? (
            <Text>配達待ちの注文はありません。</Text>
          ) : null}
          {orders.map((order) => (
            <Button
              key={order.id}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void run(async () => (await deliveryDetail(controller, order.id)).order)
              }
            >
              {order.storeName} · 直線 {(order.distanceMeters / 1000).toFixed(1)} km
            </Button>
          ))}
        </>
      )}
      <Button
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setMessage('');
          reload();
        }}
      >
        一覧・担当中の配達を再確認
      </Button>
      {busy ? <Text>確認中…</Text> : null}
    </View>
  );
}
