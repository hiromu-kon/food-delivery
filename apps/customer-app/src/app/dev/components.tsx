import { Button } from '@repo/native-ui/button';
import { Checkbox } from '@repo/native-ui/checkbox';
import { IconButton } from '@repo/native-ui/icon-button';
import { Label } from '@repo/native-ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/native-ui/select';
import { Switch } from '@repo/native-ui/switch';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { Redirect, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

const buttonVariants = ['primary', 'secondary', 'ghost', 'danger'] as const;
const buttonLabels = {
  primary: '注文を確定する',
  secondary: 'お届け先を変更する',
  ghost: 'メニューを見る',
  danger: '注文を取り消す',
} satisfies Record<(typeof buttonVariants)[number], string>;
const categories = ['定食', '丼', 'サイド', 'ドリンク', 'デザート'];

function Block({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="heading-m">{name}</Text>
      {children}
    </View>
  );
}

// 部品を Penpot と見比べるための画面。利用者に見せないため、開発中だけ開ける
export default function ComponentCatalogScreen() {
  const [toggles, setToggles] = React.useState({ on: true, off: false });
  const [checks, setChecks] = React.useState({ on: true, off: false });

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView className="bg-base" contentContainerClassName="gap-8 p-4 pb-16">
      <Stack.Screen options={{ title: 'コンポーネント' }} />
      <Block name="Button">
        {(['L', 'M'] as const).map((size) =>
          buttonVariants.map((variant) => (
            <View key={`${size}-${variant}`} className="flex-row flex-wrap gap-2">
              <Button variant={variant} size={size}>
                {buttonLabels[variant]}
              </Button>
              <Button variant={variant} size={size} disabled>
                無効
              </Button>
              <Button variant={variant} size={size} loading>
                処理しています
              </Button>
            </View>
          )),
        )}
      </Block>
      <Block name="IconButton">
        <View className="flex-row gap-4">
          <IconButton variant="filled" icon={ArrowLeft} accessibilityLabel="戻る" />
          <IconButton variant="filled" icon={ArrowLeft} accessibilityLabel="戻る" disabled />
          <IconButton icon={ArrowLeft} accessibilityLabel="戻る" />
          <IconButton icon={ArrowLeft} accessibilityLabel="戻る" disabled />
        </View>
      </Block>
      <Block name="TextField">
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
        <TextField label="メールアドレス" defaultValue="変更できません" editable={false} />
      </Block>
      <Block name="Select">
        {[false, true].map((disabled) => (
          <View key={String(disabled)} className="gap-2">
            <Label disabled={disabled}>カテゴリ</Label>
            <Select defaultValue={{ value: '定食', label: '定食' }} disabled={disabled}>
              <SelectTrigger disabled={disabled}>
                <SelectValue placeholder="選んでください" />
              </SelectTrigger>
              <SelectContent className="w-[358px]">
                {categories.map((category) => (
                  <SelectItem key={category} value={category} label={category} />
                ))}
              </SelectContent>
            </Select>
          </View>
        ))}
      </Block>
      <Block name="Toggle">
        {(
          [
            ['on', false],
            ['off', false],
            ['off', true],
          ] as const
        ).map(([key, disabled]) => (
          <View key={`${key}-${disabled}`} className="flex-row items-center gap-3">
            <Switch
              checked={toggles[key]}
              onCheckedChange={(checked) => setToggles((prev) => ({ ...prev, [key]: checked }))}
              disabled={disabled}
              accessibilityLabel="受付中"
            />
            <Text className={disabled ? 'text-disabled' : ''}>受付中</Text>
          </View>
        ))}
      </Block>
      <Block name="Checkbox">
        {(
          [
            ['on', false],
            ['off', false],
            ['off', true],
          ] as const
        ).map(([key, disabled]) => (
          <View key={`${key}-${disabled}`} className="flex-row items-center gap-3">
            <Checkbox
              checked={checks[key]}
              onCheckedChange={(checked) => setChecks((prev) => ({ ...prev, [key]: checked }))}
              disabled={disabled}
              accessibilityLabel="このお届け先をいつも使う"
            />
            <Text className={disabled ? 'text-disabled' : ''}>このお届け先をいつも使う</Text>
          </View>
        ))}
      </Block>
    </ScrollView>
  );
}
