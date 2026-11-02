import { orderStatuses } from '@repo/domain';
import { AlertDialog } from '@repo/native-ui/alert-dialog';
import { AppHeader } from '@repo/native-ui/app-header';
import { Button } from '@repo/native-ui/button';
import { CountBadge } from '@repo/native-ui/count-badge';
import { EmptyState } from '@repo/native-ui/empty-state';
import { IconButton } from '@repo/native-ui/icon-button';
import { ListItem } from '@repo/native-ui/list-item';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Spinner } from '@repo/native-ui/spinner';
import { StatusLabel } from '@repo/native-ui/status-label';
import { TabBar } from '@repo/native-ui/tab-bar';
import { Tabs } from '@repo/native-ui/tabs';
import { Tag } from '@repo/native-ui/tag';
import { Text } from '@repo/native-ui/text';
import { useToast } from '@repo/native-ui/toast';
import { Redirect, Stack, useRouter } from 'expo-router';
import { LogOut, MapPin, ReceiptText, User } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

function Block({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="heading-m">{name}</Text>
      {children}
    </View>
  );
}

function DisplayDemo() {
  const { show } = useToast();
  return (
    <View className="gap-8">
      <Block name="StatusLabel">
        <View className="flex-row flex-wrap gap-3">
          {orderStatuses.map((status) => (
            <StatusLabel key={status} status={status} />
          ))}
        </View>
      </Block>
      <Block name="Tag / CountBadge">
        <View className="flex-row flex-wrap items-center gap-3">
          <Tag>売り切れ</Tag>
          <Tag tone="warning">受付停止中</Tag>
          <CountBadge count={2} />
          <CountBadge count={20} />
          <CountBadge count={100} />
        </View>
      </Block>
      <Block name="EmptyState">
        <EmptyState
          icon={ReceiptText}
          title="まだ注文はありません"
          description="近くのお店を見てみましょう。"
          action={
            <Button onPress={() => show({ message: '店舗一覧へ移動する操作です' })}>
              近くのお店を見る
            </Button>
          }
        />
      </Block>
      <Block name="ListItem">
        <View>
          <ListItem
            icon={User}
            title="アカウント"
            onPress={() => show({ message: 'アカウントを開きます' })}
          />
          <ListItem
            icon={MapPin}
            title="いつものお届け先"
            value="自宅"
            description="東京都千代田区丸の内 1-1-1"
            onPress={() => show({ message: 'お届け先を開きます' })}
          />
          <ListItem title="注文点数" trailing={<CountBadge count={2} />} />
          <ListItem
            title="利用できません"
            disabled
            onPress={() => show({ message: 'この通知は出ません' })}
          />
          <ListItem
            icon={LogOut}
            title="ログアウトする"
            tone="danger"
            onPress={() => show({ message: 'ログアウトの操作です' })}
          />
        </View>
      </Block>
    </View>
  );
}

function FeedbackDemo() {
  const { show, dismiss } = useToast();
  const [dialog, setDialog] = React.useState<'primary' | 'danger' | null>(null);
  return (
    <View className="gap-8">
      <Block name="NoticeBanner">
        <NoticeBanner>注文の状況は、この画面から確認できます。</NoticeBanner>
        <NoticeBanner tone="warning">
          このお店は今、注文を受け付けていません。ほかのお店を選んでください。
        </NoticeBanner>
        <NoticeBanner tone="danger">
          保存できませんでした。通信状況を確認して、もう一度お試しください。
        </NoticeBanner>
      </Block>
      <Block name="Toast">
        <View className="gap-2">
          <Button variant="secondary" onPress={() => show({ message: 'お届け先を変更しました' })}>
            通知を表示する
          </Button>
          <Button
            variant="secondary"
            onPress={() => show({ tone: 'success', message: 'お届け先を保存しました' })}
          >
            完了の通知を表示する
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              show({
                tone: 'error',
                message: '保存できませんでした。通信状況を確認して、もう一度お試しください。',
              })
            }
          >
            エラーの通知を表示する
          </Button>
          <Button variant="ghost" onPress={dismiss}>
            通知を閉じる
          </Button>
        </View>
      </Block>
      <Block name="Spinner">
        <Spinner />
      </Block>
      <Block name="Dialog">
        <Button variant="secondary" onPress={() => setDialog('primary')}>
          確認のダイアログを開く
        </Button>
        <Button variant="secondary" onPress={() => setDialog('danger')}>
          取り消しのダイアログを開く
        </Button>
      </Block>
      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={dialog === 'danger' ? '注文を取り消しますか？' : 'お届け先を変更しますか？'}
        description={
          dialog === 'danger'
            ? '取り消した注文は元に戻せません。もう一度注文するには、お店から商品を選び直してください。'
            : '次の注文から、選んだお届け先を使います。'
        }
        actionLabel={dialog === 'danger' ? '注文を取り消す' : 'お届け先を変更する'}
        variant={dialog ?? 'primary'}
        onAction={() => {
          show({
            tone: 'success',
            message: dialog === 'danger' ? '注文を取り消しました' : 'お届け先を変更しました',
          });
          setDialog(null);
        }}
      />
    </View>
  );
}

function NavigationDemo() {
  const { show } = useToast();
  const [customerTab, setCustomerTab] = React.useState('home');
  const [courierTab, setCourierTab] = React.useState('deliveries');
  const [tab, setTab] = React.useState('current');
  return (
    <View className="gap-8">
      <Block name="AppHeader">
        <AppHeader title="ホーム" />
        <AppHeader title="注文の確認" onBack={() => show({ message: '前の画面に戻る操作です' })} />
        <AppHeader
          title="お届け先"
          onBack={() => show({ message: '前の画面に戻る操作です' })}
          right={
            <IconButton
              icon={User}
              accessibilityLabel="アカウントを開く"
              onPress={() => show({ message: 'アカウントを開きます' })}
            />
          }
        />
      </Block>
      <Block name="TabBar（注文者）">
        <TabBar app="customer" value={customerTab} onValueChange={setCustomerTab} />
      </Block>
      <Block name="TabBar（配達員）">
        <TabBar app="courier" value={courierTab} onValueChange={setCourierTab} />
      </Block>
      <Block name="Tabs">
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'current', label: '進行中', content: <Text>進行中の注文</Text> },
            { value: 'past', label: '過去の注文', content: <Text>過去の注文</Text> },
            { value: 'disabled', label: '利用できません', disabled: true, content: null },
          ]}
        />
      </Block>
    </View>
  );
}

// 実際の注文・保存は行わず、部品の状態と操作を開発時だけ確認する
export default function DisplayComponentCatalogScreen() {
  const [section, setSection] = React.useState('display');
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView className="bg-base" contentContainerClassName="gap-6 p-4 pb-16">
      <Stack.Screen options={{ title: '表示・お知らせ・移動' }} />
      <Button variant="ghost" onPress={() => router.push('/dev/components')}>
        操作と入力の部品を見る
      </Button>
      <Button variant="ghost" onPress={() => router.push('/dev/customer-components')}>
        注文者の部品を見る
      </Button>
      <Tabs
        value={section}
        onValueChange={setSection}
        items={[
          { value: 'display', label: '表示', content: <DisplayDemo /> },
          { value: 'feedback', label: 'お知らせ', content: <FeedbackDemo /> },
          { value: 'navigation', label: '移動', content: <NavigationDemo /> },
        ]}
      />
    </ScrollView>
  );
}
