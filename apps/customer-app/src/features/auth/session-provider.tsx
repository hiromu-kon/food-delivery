import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { sessionTransport } from '@/api/auth';
import { SessionController } from './session';

const key = 'customer.signed-session';
const SessionContext = createContext<SessionController | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(
    () =>
      new SessionController(
        {
          read: () => SecureStore.getItemAsync(key),
          write: (token) =>
            SecureStore.setItemAsync(key, token, {
              keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            }),
          clear: () => SecureStore.deleteItemAsync(key),
        },
        sessionTransport,
      ),
  );
  useEffect(() => {
    void controller.restore();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void controller.refresh();
    });
    return () => listener.remove();
  }, [controller]);
  return <SessionContext.Provider value={controller}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error('SessionProvider が必要です');
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { state, controller };
}
