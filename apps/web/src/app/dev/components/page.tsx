import { orderStatuses } from '@repo/domain';
import { ArrowLeftIcon, ReceiptTextIcon } from 'lucide-react';
import { notFound } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CountBadge } from '@/components/ui/count-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Label } from '@/components/ui/label';
import { NoticeBanner } from '@/components/ui/notice-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { StatusLabel } from '@/components/ui/status-label';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { TextField } from '@/components/ui/text-field';

import { ToastDemo } from './toast-demo';

const buttonVariants = ['primary', 'secondary', 'ghost', 'danger'] as const;
const buttonSizes = ['L', 'M'] as const;
const buttonLabels = {
  primary: '注文を確定する',
  secondary: 'お届け先を変更する',
  ghost: 'メニューを見る',
  danger: '注文を取り消す',
} satisfies Record<(typeof buttonVariants)[number], string>;
const categories = ['定食', '丼', 'サイド', 'ドリンク', 'デザート'];
const dialogs = [
  {
    variant: 'primary',
    trigger: 'confirm を開く',
    title: 'カートを空にしますか？',
    description:
      'カートには別のお店の商品が入っています。空にすると、このお店の商品を入れられます。',
    cancel: '今のカートを残す',
    action: 'カートを空にする',
  },
  {
    variant: 'danger',
    trigger: 'danger を開く',
    title: '注文を取り消しますか？',
    description: 'お店が受け付ける前なので、代金は請求されません。',
    cancel: '取り消さない',
    action: '注文を取り消す',
  },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-heading-l">{title}</h2>
      <div className="flex flex-wrap items-start gap-10">{children}</div>
    </section>
  );
}

function Block({
  name,
  description,
  children,
}: {
  name: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-m">{name}</h3>
        <p className="text-body-s text-secondary">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function ComponentCatalogPage() {
  // 利用者に見せないページのため本番では 404 にする。layout に置くとページが並行して描画され、中身が応答に残る。
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <main className="flex flex-col gap-12 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display font-display">コンポーネント</h1>
        <p className="text-body-m text-secondary">
          Penpot の「03
          コンポーネント」と見比べるためのページ。ホバーとフォーカスは操作して確かめる。
        </p>
      </div>

      <Section title="操作">
        <Block
          name="Button"
          description="primary は 1 画面に 1 つ。danger は確認のダイアログの中だけ。"
        >
          {buttonSizes.map((size) => (
            <div key={size} className="flex flex-col gap-3">
              {buttonVariants.map((variant) => (
                <div key={variant} className="flex items-center gap-4">
                  <Button variant={variant} size={size}>
                    {buttonLabels[variant]}
                  </Button>
                  <Button variant={variant} size={size} disabled>
                    {buttonLabels[variant]}
                  </Button>
                  <Button variant={variant} size={size} loading>
                    処理しています
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </Block>
        <Block name="IconButton" description="戻る・閉じるなど。読み上げ用の名前を付ける。">
          {(['filled', 'plain'] as const).map((variant) => (
            <div key={variant} className="flex items-center gap-4">
              <IconButton variant={variant} aria-label="戻る">
                <ArrowLeftIcon />
              </IconButton>
              <IconButton variant={variant} aria-label="戻る" disabled>
                <ArrowLeftIcon />
              </IconButton>
            </div>
          ))}
        </Block>
      </Section>

      <Section title="入力">
        <Block name="TextField" description="ラベルは上。エラーは欄の下に直し方まで書く。">
          <div className="grid w-170 grid-cols-2 gap-6">
            <TextField
              label="メールアドレス"
              placeholder="example@mail.jp"
              helperText="注文の確認をこのアドレスに送ります"
            />
            <TextField
              label="メールアドレス"
              defaultValue="example@"
              errorMessage="@ の後ろまで入力してください（例：taro@mail.jp）"
            />
            <TextField
              label="メールアドレス"
              defaultValue="変更できません"
              helperText="注文の確認をこのアドレスに送ります"
              disabled
            />
          </div>
        </Block>
        <Block name="Select" description="選択肢が 5 つ以上のとき。">
          {[false, true].map((disabled) => (
            <div key={String(disabled)} className="flex w-70 flex-col gap-2">
              <Label htmlFor={`category-${disabled}`}>カテゴリ</Label>
              <Select defaultValue="定食" disabled={disabled}>
                <SelectTrigger id={`category-${disabled}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </Block>
        <Block name="Toggle" description="すぐ反映される切替（売り切れ・稼働中・受付中）。">
          {[
            { id: 'toggle-on', checked: true, disabled: false },
            { id: 'toggle-off', checked: false, disabled: false },
            { id: 'toggle-disabled', checked: false, disabled: true },
          ].map(({ id, checked, disabled }) => (
            <div key={id} className="flex items-center gap-3">
              <Switch id={id} defaultChecked={checked} disabled={disabled} />
              <Label htmlFor={id} className="text-body-m">
                受付中
              </Label>
            </div>
          ))}
        </Block>
        <Block name="Checkbox" description="保存ボタンで確定する選択。">
          {[
            { id: 'checkbox-on', checked: true, disabled: false },
            { id: 'checkbox-off', checked: false, disabled: false },
            { id: 'checkbox-disabled', checked: false, disabled: true },
          ].map(({ id, checked, disabled }) => (
            <div key={id} className="flex items-center gap-3">
              <Checkbox id={id} defaultChecked={checked} disabled={disabled} />
              <Label htmlFor={id} className="text-body-m">
                このお届け先をいつも使う
              </Label>
            </div>
          ))}
        </Block>
      </Section>
      <Section title="表示">
        <Block name="StatusLabel" description="注文の状態。状態と 1 対 1 で対応する。">
          <div className="flex flex-col items-start gap-3">
            {orderStatuses.map((status) => (
              <StatusLabel key={status} status={status} />
            ))}
          </div>
        </Block>
        <Block name="Tag" description="店舗の受付の状態など、短い補足。">
          <div className="flex flex-col items-start gap-3">
            <Tag tone="warning">まもなく受付終了</Tag>
            <Tag tone="neutral">受付停止中</Tag>
          </div>
        </Block>
        <Block name="CountBadge" description="カートの点数など。">
          <div className="flex items-center gap-3">
            <CountBadge count={2} />
            <CountBadge count={12} />
          </div>
        </Block>
      </Section>

      <Section title="お知らせ">
        <Block name="NoticeBanner" description="画面にとどまる状態の説明。">
          <div className="flex w-90 flex-col gap-3">
            <NoticeBanner tone="info">お店が受け付けると、調理が始まります</NoticeBanner>
            <NoticeBanner tone="warning">最低注文金額まで、あと ¥240 です</NoticeBanner>
            <NoticeBanner tone="danger">このお店は今、注文を受け付けていません</NoticeBanner>
          </div>
        </Block>
        <Block
          name="Toast"
          description="操作の結果を数秒だけ伝える。ボタンを押すと画面の下に出る。"
        >
          <ToastDemo />
        </Block>
        <Block name="Spinner" description="1 秒以上かかる読み込み。">
          <Spinner />
        </Block>
        <Block name="EmptyState" description="空のとき。次の行動のボタンを必ず置く。">
          <EmptyState
            className="w-80"
            icon={<ReceiptTextIcon />}
            title="まだ注文はありません"
            description="近くのお店を見てみましょう"
            action={<Button variant="secondary">お店を探す</Button>}
          />
        </Block>
      </Section>

      <Section title="重ねて出すもの">
        <Block name="Dialog" description="元に戻せない操作の前の確認だけ。実行する側を右に置く。">
          <div className="flex gap-3">
            {dialogs.map((dialog) => (
              <AlertDialog key={dialog.variant}>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" size="M">
                    {dialog.trigger}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
                  <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{dialog.cancel}</AlertDialogCancel>
                    <AlertDialogAction variant={dialog.variant}>{dialog.action}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </div>
        </Block>
      </Section>
    </main>
  );
}
