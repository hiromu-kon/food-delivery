import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import * as React from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '../cn';

import { Icon } from './icon';
import { Text } from './text';

type ToastMessage = { message: string; tone?: 'default' | 'success' | 'error'; duration?: number };
type ToastContextValue = { show: (message: ToastMessage) => void; dismiss: () => void };

const ToastContext = React.createContext<ToastContextValue | null>(null);
const toastIcons = { default: Info, success: CircleCheck, error: CircleAlert };

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = React.useState<ToastMessage | null>(null);
  const insets = useSafeAreaInsets();
  const dismiss = React.useCallback(() => setEntry(null), []);
  const show = React.useCallback((message: ToastMessage) => {
    setEntry({ ...message });
    AccessibilityInfo.announceForAccessibility(message.message);
  }, []);
  const context = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);

  React.useEffect(() => {
    if (!entry) return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // 読み上げや端末の操作時間の設定より先に通知を消さない
    void AccessibilityInfo.getRecommendedTimeoutMillis(entry.duration ?? 4000).then((duration) => {
      if (active) timeout = setTimeout(dismiss, duration);
    });
    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [entry, dismiss]);

  return (
    <ToastContext.Provider value={context}>
      {children}
      {entry && (
        <View
          pointerEvents="box-none"
          className="absolute inset-x-0 z-50 items-center px-4"
          style={{ bottom: insets.bottom + 16 }}
        >
          <View
            className={cn(
              'shadow-overlay max-w-full flex-row items-center gap-2 rounded-sm px-4 py-3',
              entry.tone === 'error' ? 'bg-danger' : 'bg-(--text-color-primary)',
            )}
          >
            <Icon
              as={toastIcons[entry.tone ?? 'default']}
              className="text-on-brand size-4.5"
              aria-hidden
            />
            <Text className="text-on-brand shrink">{entry.message}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast は ToastProvider の内側で使ってください');
  return context;
}

export { ToastProvider, useToast, type ToastMessage };
