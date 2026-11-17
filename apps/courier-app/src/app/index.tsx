import type { AuthUser } from '@repo/contract';
import { signInSchema } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { TextField } from '@repo/native-ui/text-field';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, ScrollView, Switch, View } from 'react-native';

import { getCourier, setAvailability } from '@/api/courier';
import { AuthRequestError, errorMessage } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import { Deliveries } from '@/features/deliveries/deliveries';
import { useSession } from '@/features/auth/session-provider';

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScrollView
      className="bg-base flex-1"
      contentContainerStyle={{ padding: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title }} />
      <View className="w-full max-w-lg self-center gap-6">{children}</View>
    </ScrollView>
  );
}

function useAction() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const invalidate = () => {
      generation.current++;
    };
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') invalidate();
      else {
        locked.current = false;
        setBusy(false);
      }
    });
    return () => {
      invalidate();
      listener.remove();
    };
  }, []);
  async function run(action: (isCurrent: () => boolean) => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    const current = generation.current;
    const isCurrent = () => current === generation.current;
    setBusy(true);
    setMessage('');
    try {
      await action(isCurrent);
    } catch (error) {
      if (isCurrent()) setMessage(errorMessage(error));
    } finally {
      if (isCurrent()) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  return { message, busy, run };
}

function Login({ controller, notice }: { controller: SessionController; notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  return (
    <Screen title="配達員ログイン">
      <Text variant="heading-l">配達員ログイン</Text>
      <Text className="text-secondary">運営から発行されたアカウントでログインしてください。</Text>
      {notice ? (
        <Text accessibilityRole="alert" className="text-danger">
          {notice}
        </Text>
      ) : null}
      <TextField
        label="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        editable={!action.busy}
      />
      <TextField
        label="パスワード"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        editable={!action.busy}
      />
      <Button
        loading={action.busy}
        onPress={() =>
          void action.run(async () => {
            const result = signInSchema.safeParse({ email: email.trim(), password });
            if (!result.success)
              throw new AuthRequestError('メールアドレスとパスワードを確認してください。');
            await controller.login(result.data);
          })
        }
      >
        ログイン
      </Button>
      {action.message ? (
        <Text accessibilityRole="alert" className="text-danger">
          {action.message}
        </Text>
      ) : null}
    </Screen>
  );
}

function CourierHome({ controller, user }: { controller: SessionController; user: AuthUser }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(false);
  const action = useAction();
  useEffect(() => {
    let active = true;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') active = false;
    });
    void getCourier(controller)
      .then((result) => {
        if (active) {
          setAvailable(result.courier.isAvailable);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(errorMessage(error));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      listener.remove();
    };
  }, [controller]);
  return (
    <Screen title={account ? 'アカウント' : 'ホーム'}>
      <View className="flex-row justify-between">
        <Button variant="ghost" disabled={action.busy} onPress={() => setAccount(false)}>
          ホーム
        </Button>
        <Button variant="ghost" disabled={action.busy} onPress={() => setAccount(true)}>
          アカウント
        </Button>
      </View>
      {account ? (
        <>
          <Text variant="heading-l">登録情報</Text>
          <Text>{user.name}</Text>
          <Text>{user.email}</Text>
          <Text>{user.phoneNumber}</Text>
          <Button loading={action.busy} onPress={() => void action.run(controller.logout)}>
            ログアウト
          </Button>
        </>
      ) : (
        <>
          <Text variant="heading-l">{user.name}さん</Text>
          <View className="bg-subtle rounded-md p-6 gap-4">
            <Text variant="heading-l">
              {available === null ? '稼働状態を確認してください' : available ? '稼働中' : '休止中'}
            </Text>
            <Text className="text-secondary">稼働を始めるときはスイッチをオンにしてください。</Text>
            <Switch
              accessibilityLabel="稼働中"
              value={available ?? false}
              disabled={action.busy || available === null}
              onValueChange={(value) =>
                void action.run(async (isCurrent) => {
                  try {
                    const result = await setAvailability(controller, value);
                    if (isCurrent()) setAvailable(result.isAvailable);
                  } catch (error) {
                    if (isCurrent()) setAvailable(null);
                    throw error;
                  }
                })
              }
            />
          </View>
          <Button
            variant="secondary"
            disabled={loading}
            loading={action.busy}
            onPress={() =>
              void action.run(async (isCurrent) => {
                const result = await getCourier(controller);
                if (isCurrent()) {
                  setAvailable(result.courier.isAvailable);
                  setLoadError('');
                }
              })
            }
          >
            稼働状態を再確認
          </Button>
          {available !== null ? (
            <Deliveries key={String(available)} controller={controller} available={available} />
          ) : null}
          {loadError ? (
            <Text accessibilityRole="alert" className="text-danger">
              {loadError}
            </Text>
          ) : null}
        </>
      )}
      {action.message ? (
        <Text accessibilityRole="alert" className="text-danger">
          {action.message}
        </Text>
      ) : null}
    </Screen>
  );
}

export default function HomeScreen() {
  const { state, controller } = useSession();
  if (state.status === 'loading')
    return (
      <Screen title="確認中">
        <ActivityIndicator accessibilityLabel="ログインを確認中" />
      </Screen>
    );
  if (state.status === 'error')
    return (
      <Screen title="ログインの確認">
        <Text accessibilityRole="alert">{state.message}</Text>
        <Button
          onPress={() =>
            void (state.retry === 'restore' ? controller.restore() : controller.logout())
          }
        >
          再試行
        </Button>
      </Screen>
    );
  if (state.status === 'anonymous')
    return <Login controller={controller} {...(state.message && { notice: state.message })} />;
  return <CourierHome key={state.user.id} controller={controller} user={state.user} />;
}
