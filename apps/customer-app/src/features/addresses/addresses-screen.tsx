import { AlertDialog } from '@repo/native-ui/alert-dialog';
import { Button } from '@repo/native-ui/button';
import { NoticeBanner } from '@repo/native-ui/notice-banner';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { createAddressTransport } from '@/api/addresses';
import { AuthScreen, FormError } from '@/features/auth/auth-screen';
import { useSession } from '@/features/auth/session-provider';
import { AddressesController } from './addresses';

export function AddressesScreen() {
  const { controller: session, state: auth } = useSession();
  const controller = useMemo(
    () => new AddressesController(createAddressTransport(session)),
    [session],
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const keepSession =
    auth.status === 'authenticated' || (auth.status === 'loading' && auth.authenticated === true);
  const ready = auth.status === 'authenticated';
  useEffect(() => () => controller.reset(), [controller]);
  useEffect(() => {
    if (ready) {
      if (!controller.getSnapshot().loaded) void controller.load();
    } else if (!keepSession) {
      controller.reset();
    }
  }, [ready, keepSession, controller]);
  const editor = state.editor;
  return (
    <AuthScreen title="お届け先">
      <FormError message={state.error} />
      {editor ? (
        <>
          <Text variant="heading-m">{editor.original ? 'お届け先を編集' : 'お届け先を登録'}</Text>
          <TextField
            label="住所（必須）"
            helperText="都道府県から番地まで（200文字以内）"
            value={editor.values.address}
            onChangeText={(value) => controller.change('address', value)}
            editable={!state.pending}
            maxLength={200}
            autoComplete="street-address"
          />
          <TextField
            label="建物名・部屋番号"
            helperText="100文字以内"
            value={editor.values.building}
            onChangeText={(value) => controller.change('building', value)}
            editable={!state.pending}
            maxLength={100}
          />
          <TextField
            label="配達メモ"
            helperText={`${editor.values.deliveryNote.length}/100文字`}
            value={editor.values.deliveryNote}
            onChangeText={(value) => controller.change('deliveryNote', value)}
            editable={!state.pending}
            maxLength={100}
            multiline
          />
          <Button
            loading={state.pending}
            onPress={() => {
              void controller.save();
            }}
          >
            保存する
          </Button>
          <Button variant="secondary" disabled={state.pending} onPress={controller.cancel}>
            キャンセル
          </Button>
        </>
      ) : (
        <>
          <Button disabled={state.pending || !state.loaded} onPress={() => controller.edit()}>
            お届け先を登録する
          </Button>
          {state.pending && <ActivityIndicator accessibilityLabel="お届け先を処理中" />}
          {state.loaded && state.addresses.length === 0 && (
            <NoticeBanner>お届け先はまだ登録されていません。</NoticeBanner>
          )}
          {state.addresses.map((address) => (
            <View key={address.id} className="border-default gap-3 rounded-md border p-4">
              <Text variant="heading-m" selectable>
                {address.address}
              </Text>
              {address.building !== '' && <Text selectable>{address.building}</Text>}
              {address.deliveryNote !== '' && (
                <Text className="text-secondary" selectable>
                  配達メモ：{address.deliveryNote}
                </Text>
              )}
              <View className="flex-row gap-3">
                <Button
                  variant="secondary"
                  size="M"
                  accessibilityLabel={`${address.address}を編集`}
                  disabled={state.pending}
                  onPress={() => controller.edit(address)}
                >
                  編集
                </Button>
                <Button
                  variant="danger"
                  size="M"
                  accessibilityLabel={`${address.address}を削除`}
                  disabled={state.pending}
                  onPress={() => controller.confirmDelete(address)}
                >
                  削除
                </Button>
              </View>
            </View>
          ))}
          <Button
            variant="secondary"
            disabled={state.pending}
            onPress={() => {
              void controller.load();
            }}
          >
            一覧を再読み込み
          </Button>
        </>
      )}
      <AlertDialog
        open={Boolean(state.deleting)}
        onOpenChange={(open) => {
          if (!open) controller.cancel();
        }}
        title="お届け先を削除しますか？"
        description={[
          state.deleting?.address,
          state.deleting?.building,
          state.deleting?.deliveryNote,
          state.error,
          '削除すると元に戻せません。',
        ]
          .filter(Boolean)
          .join('\n')}
        actionLabel="削除する"
        cancelLabel="キャンセル"
        variant="danger"
        loading={state.pending}
        onAction={() => {
          void controller.remove();
        }}
      />
    </AuthScreen>
  );
}
