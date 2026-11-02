'use client';

import { orderStatuses } from '@repo/domain';
import { LogOutIcon, MapPinIcon, ReceiptTextIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { CustomerHeader } from '@/components/customer/customer-header';
import { AddButton } from '@/components/ui/add-button';
import { Button } from '@/components/ui/button';
import { CartBar } from '@/components/ui/cart-bar';
import { CountBadge } from '@/components/ui/count-badge';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ListItem } from '@/components/ui/list-item';
import { MenuItem } from '@/components/ui/menu-item';
import { OrderSteps } from '@/components/ui/order-steps';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { StoreCard } from '@/components/ui/store-card';
import { StoreNoren } from '@/components/ui/store-noren';
import { TextField } from '@/components/ui/text-field';

import { samplePhotoUrl } from './sample-photo';

function Block({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="flex min-w-0 flex-col gap-4">
      <h2 className="text-heading-l">{title}</h2>
      {children}
    </section>
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
    <div className="flex flex-col gap-2">
      <h3 className="text-body-l">{itemName}</h3>
      {quantity === null ? (
        <>
          <p>カートから外しました</p>
          <Button
            className="self-start"
            variant="ghost"
            onClick={() => setQuantity(initialQuantity)}
          >
            もう一度追加する
          </Button>
        </>
      ) : (
        <QuantityStepper
          quantity={quantity}
          itemName={itemName}
          onQuantityChange={setQuantity}
          onRemove={() => setQuantity(null)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function DrawerDemo({ mode = 'address' }: { mode?: 'address' | 'input' | 'long' }) {
  const [open, setOpen] = React.useState(false);
  const [address, setAddress] = React.useState('自宅');
  const trigger =
    mode === 'input'
      ? '入力するシートを開く'
      : mode === 'long'
        ? '長い内容のシートを開く'
        : 'お届け先を選ぶ';
  return (
    <div className="flex flex-col items-start gap-2">
      {mode === 'address' && <p data-testid="selected-address">選んでいるお届け先：{address}</p>}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button variant="secondary">{trigger}</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerTitle>
            {mode === 'input' ? 'お届け先にメモを付ける' : 'お届け先を選ぶ'}
          </DrawerTitle>
          <DrawerDescription>
            {mode === 'input'
              ? '建物の入り方などを入力できます。'
              : 'この注文のお届け先を選んでください。'}
          </DrawerDescription>
          {mode === 'input' ? (
            <>
              <TextField label="配達メモ" placeholder="建物の入り方など" maxLength={100} />
              <Button
                onClick={() => {
                  setOpen(false);
                  toast.success('確認用の入力を終了しました');
                }}
              >
                入力を終える
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {(mode === 'long'
                  ? Array.from({ length: 15 }, (_, index) => `お届け先 ${index + 1}`)
                  : ['自宅', '職場']
                ).map((name) => (
                  <ListItem
                    key={name}
                    title={name}
                    description="〇〇市△△町 1-2-3 □□マンション 201"
                    icon={<MapPinIcon />}
                    selected={address === name}
                    value={address === name ? '選択中' : ''}
                    chevron={false}
                    className="rounded-sm border"
                    onClick={() => {
                      setAddress(name);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
              <DrawerClose asChild>
                <Button variant="secondary">戻る</Button>
              </DrawerClose>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function CustomerComponentsDemo() {
  return (
    <>
      <CustomerHeader
        brandHref="/dev/customer-components"
        items={[
          { href: '#stores', label: 'お店を探す', current: true },
          { href: '#orders', label: '注文履歴' },
          { href: '#account', label: 'アカウント' },
        ]}
      />
      <main className="mx-auto flex w-full max-w-300 flex-col gap-12 px-4 py-8 md:px-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-display font-display">注文者のコンポーネント</h1>
          <p className="text-body-m text-secondary">
            PC 用メニューは 768px 以上で表示します。図形画像は読み込みの確認用です。
          </p>
          <Link href="/dev/components" className="text-brand underline">
            共通のコンポーネントを見る
          </Link>
        </div>
        <Block title="StoreNoren / StoreCard" id="stores">
          <div className="max-w-89.5">
            <StoreNoren name="〇〇食堂" description="和食と定食　創業 1978 年" />
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <StoreCard
              href="#menu"
              name="〇〇食堂"
              photoUrl={samplePhotoUrl}
              deliveryFee={300}
              minimumOrderAmount={1000}
              distanceMeters={1200}
            />
            <StoreCard
              href="#menu"
              name="受付停止中のお店"
              paused
              deliveryFee={300}
              minimumOrderAmount={0}
              distanceMeters={800}
            />
            <StoreCard
              href="#menu"
              name="とても長い店舗名でも折り返して読める地域のお店"
              photoUrl="/dev-photo-not-found.png"
              deliveryFee={300}
              minimumOrderAmount={1500}
              distanceMeters={2500}
            />
          </div>
        </Block>
        <Block title="MenuItem" id="menu">
          <div className="max-w-140">
            <MenuItem
              name="唐揚げ定食"
              description="国産鶏のもも肉を二度揚げに。ご飯と味噌汁、小鉢付き"
              price={980}
              photoUrl={samplePhotoUrl}
              onAdd={() => toast.success('唐揚げ定食をカートに入れました')}
            />
            <MenuItem
              name="売り切れの定食"
              price={1080}
              soldOut
              photoUrl={samplePhotoUrl}
              onAdd={() => toast('この通知は出ません')}
            />
            <MenuItem
              name="写真のない定食"
              description="写真を登録していない商品です"
              price={1050}
              onAdd={() => toast.success('写真のない定食をカートに入れました')}
            />
            <MenuItem
              name="写真を読み込めない定食"
              price={980}
              photoUrl="/dev-photo-not-found.png"
              onAdd={() => toast.success('写真を読み込めない定食をカートに入れました')}
            />
            <MenuItem
              name="受付停止中の定食"
              price={980}
              disabled
              onAdd={() => toast('この通知は出ません')}
            />
          </div>
        </Block>
        <Block title="AddButton / QuantityStepper" id="cart">
          <div className="flex gap-4">
            <AddButton
              aria-label="定食をカートに入れる"
              onClick={() => toast.success('定食をカートに入れました')}
            />
            <AddButton aria-label="停止中の定食をカートに入れる" disabled />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <QuantityDemo itemName="通常の定食" initialQuantity={2} />
            <QuantityDemo itemName="最小の定食" initialQuantity={1} />
            <QuantityDemo itemName="最大の定食" initialQuantity={20} />
            <QuantityDemo itemName="変更できない定食" initialQuantity={2} disabled />
          </div>
        </Block>
        <Block title="CartBar">
          <div className="max-w-89.5">
            <CartBar count={2} subtotal={1960} onClick={() => toast('カートを開く操作です')} />
            <CartBar count={0} subtotal={0} />
          </div>
          <p className="text-body-s text-secondary">0 点のカートは表示しません。</p>
        </Block>
        <Block title="OrderSteps" id="orders">
          <div className="grid gap-8 md:grid-cols-2">
            {orderStatuses.map((status) => (
              <div key={status} className="flex flex-col gap-3">
                <h3 className="text-label-m">{status}</h3>
                <OrderSteps status={status} />
              </div>
            ))}
          </div>
        </Block>
        <Block title="ListItem" id="account">
          <div className="max-w-140">
            <ListItem title="アカウント" icon={<UserIcon />} href="#account" />
            <ListItem
              title="お届け先"
              icon={<MapPinIcon />}
              value="自宅"
              onClick={() => toast('お届け先を開く操作です')}
            />
            <ListItem
              title="注文点数"
              icon={<ReceiptTextIcon />}
              trailing={<CountBadge count={2} />}
            />
            <ListItem title="利用できません" disabled onClick={() => toast('この通知は出ません')} />
            <ListItem
              title="ログアウトする"
              tone="danger"
              icon={<LogOutIcon />}
              onClick={() => toast('ログアウトの操作です')}
            />
          </div>
        </Block>
        <Block title="BottomSheet（Drawer）">
          <div className="flex flex-wrap items-end gap-6">
            <DrawerDemo />
            <DrawerDemo mode="input" />
            <DrawerDemo mode="long" />
          </div>
        </Block>
      </main>
    </>
  );
}
