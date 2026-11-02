import { orderStatuses } from '@repo/domain';
import { Button } from '@repo/native-ui/button';
import { ListItem } from '@repo/native-ui/list-item';
import { Tabs } from '@repo/native-ui/tabs';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { useToast } from '@repo/native-ui/toast';
import { Redirect, Stack, useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { AddButton } from '@/components/cart/add-button';
import { CartBar } from '@/components/cart/cart-bar';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { OrderSteps } from '@/components/order/order-steps';
import { BottomSheet } from '@/components/sheet/bottom-sheet';
import { MenuItem } from '@/components/store/menu-item';
import { StoreCard } from '@/components/store/store-card';
import { StoreNoren } from '@/components/store/store-noren';

import { samplePhotoUrl } from '@/dev/sample-photo';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="heading-m">{title}</Text>
      {children}
    </View>
  );
}

function StoreDemo() {
  const { show } = useToast();
  return (
    <View className="gap-8">
      <Block title="StoreNoren">
        <StoreNoren name="〇〇食堂" description="和食と定食　創業 1978 年" />
      </Block>
      <Block title="StoreCard">
        <Text variant="body-s" className="text-secondary">
          図形画像は読み込みの確認用です。
        </Text>
        <StoreCard
          name="〇〇食堂"
          photoUrl={samplePhotoUrl}
          deliveryFee={300}
          minimumOrderAmount={1000}
          distanceMeters={1200}
          onPress={() => show({ message: '店舗のメニューを開く操作です' })}
        />
        <StoreCard
          name="受付停止中のお店"
          paused
          deliveryFee={300}
          minimumOrderAmount={0}
          distanceMeters={800}
          onPress={() => show({ message: '停止中のお店もメニューを見られます' })}
        />
      </Block>
      <Block title="MenuItem">
        <View>
          <MenuItem
            name="唐揚げ定食"
            description="国産鶏のもも肉を二度揚げに。ご飯と味噌汁、小鉢付き"
            price={980}
            photoUrl={samplePhotoUrl}
            onAdd={() => show({ tone: 'success', message: '唐揚げ定食をカートに入れました' })}
          />
          <MenuItem
            name="売り切れの定食"
            price={1080}
            photoUrl={samplePhotoUrl}
            soldOut
            onAdd={() => show({ message: 'この通知は出ません' })}
          />
          <MenuItem
            name="写真のない定食"
            description="写真を登録していない商品です"
            price={1050}
            onAdd={() => show({ tone: 'success', message: '写真のない定食をカートに入れました' })}
          />
          <MenuItem
            name="写真を読み込めない定食"
            photoUrl="data:image/png;base64,invalid"
            price={980}
            onAdd={() =>
              show({ tone: 'success', message: '写真を読み込めない定食をカートに入れました' })
            }
          />
          <MenuItem
            name="受付停止中の定食"
            price={980}
            disabled
            onAdd={() => show({ message: 'この通知は出ません' })}
          />
        </View>
      </Block>
    </View>
  );
}

function QuantityDemo({
  initialQuantity,
  itemName,
  disabled = false,
}: {
  initialQuantity: number;
  itemName: string;
  disabled?: boolean;
}) {
  const [quantity, setQuantity] = React.useState<number | null>(initialQuantity);
  return (
    <View className="gap-2">
      <Text>{itemName}</Text>
      {quantity === null ? (
        <>
          <Text>カートから外しました</Text>
          <Button variant="ghost" onPress={() => setQuantity(initialQuantity)}>
            もう一度追加する
          </Button>
        </>
      ) : (
        <QuantityStepper
          itemName={itemName}
          quantity={quantity}
          onQuantityChange={setQuantity}
          onRemove={() => setQuantity(null)}
          disabled={disabled}
        />
      )}
    </View>
  );
}

function CartDemo() {
  const { show } = useToast();
  return (
    <View className="gap-8">
      <Block title="AddButton">
        <View className="flex-row gap-4">
          <AddButton
            accessibilityLabel="定食をカートに入れる"
            onPress={() => show({ tone: 'success', message: '定食をカートに入れました' })}
          />
          <AddButton accessibilityLabel="受付停止中の定食をカートに入れる" disabled />
        </View>
      </Block>
      <Block title="QuantityStepper">
        <QuantityDemo itemName="通常の数量" initialQuantity={2} />
        <QuantityDemo itemName="最小の数量" initialQuantity={1} />
        <QuantityDemo itemName="最大の数量" initialQuantity={20} />
        <QuantityDemo itemName="変更できない数量" initialQuantity={2} disabled />
      </Block>
      <Block title="CartBar">
        <CartBar
          count={2}
          subtotal={1960}
          onPress={() => show({ message: 'カートを開く操作です' })}
        />
        <Text variant="body-s" className="text-secondary">
          0 点のときは、次のバーを表示しません。
        </Text>
        <CartBar count={0} subtotal={0} />
      </Block>
    </View>
  );
}

function SheetDemo() {
  const [sheet, setSheet] = React.useState<'address' | 'input' | 'long' | null>(null);
  const [address, setAddress] = React.useState('自宅');
  const { show } = useToast();
  return (
    <Block title="BottomSheet">
      <Text>選んでいるお届け先：{address}</Text>
      <Button variant="secondary" onPress={() => setSheet('address')}>
        お届け先を選ぶ
      </Button>
      <Button variant="secondary" onPress={() => setSheet('input')}>
        入力するシートを開く
      </Button>
      <Button variant="secondary" onPress={() => setSheet('long')}>
        長い内容のシートを開く
      </Button>
      <BottomSheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        title={sheet === 'input' ? 'お届け先にメモを付ける' : 'お届け先を選ぶ'}
      >
        {sheet === 'input' ? (
          <>
            <TextField label="配達メモ" placeholder="建物の入り方など" multiline maxLength={100} />
            <Button
              onPress={() => {
                setSheet(null);
                show({ tone: 'success', message: '確認用の入力を終了しました' });
              }}
            >
              入力を終える
            </Button>
          </>
        ) : (
          <>
            {(sheet === 'long'
              ? Array.from({ length: 15 }, (_, index) => `お届け先 ${index + 1}`)
              : ['自宅', '職場']
            ).map((name) => (
              <ListItem
                key={name}
                icon={MapPin}
                title={name}
                description="〇〇市△△町 1-2-3 □□マンション 201"
                value={address === name ? '選択中' : ''}
                chevron={false}
                accessibilityState={{ selected: address === name }}
                className={
                  address === name
                    ? 'bg-brand-subtle border-focus rounded-sm border'
                    : 'border-default rounded-sm border'
                }
                onPress={() => {
                  setAddress(name);
                  setSheet(null);
                }}
              />
            ))}
            <Button variant="ghost" onPress={() => setSheet('input')}>
              お届け先を追加する
            </Button>
          </>
        )}
      </BottomSheet>
    </Block>
  );
}

// 実店舗や実際の注文に影響させず、開発中だけ部品を操作する
export default function CustomerComponentCatalogScreen() {
  const [section, setSection] = React.useState('store');
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView className="bg-base" contentContainerClassName="gap-6 p-4 pb-16">
      <Stack.Screen options={{ title: '注文者の部品' }} />
      <Button variant="ghost" onPress={() => router.push('/dev/display-components')}>
        共通の部品を見る
      </Button>
      <Tabs
        value={section}
        onValueChange={setSection}
        items={[
          { value: 'store', label: '店舗・商品', content: <StoreDemo /> },
          { value: 'cart', label: 'カート', content: <CartDemo /> },
          {
            value: 'order',
            label: '注文状況',
            content: (
              <View className="gap-8">
                {orderStatuses.map((status) => (
                  <Block key={status} title={status}>
                    <OrderSteps status={status} />
                  </Block>
                ))}
              </View>
            ),
          },
          { value: 'sheet', label: 'シート', content: <SheetDemo /> },
        ]}
      />
    </ScrollView>
  );
}
