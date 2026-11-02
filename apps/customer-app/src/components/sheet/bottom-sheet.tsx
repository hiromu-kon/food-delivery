import { cn } from '@repo/native-ui/cn';
import { IconButton } from '@repo/native-ui/icon-button';
import { Text } from '@repo/native-ui/text';
import { X } from 'lucide-react-native';
import * as React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
  useAnimatedValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
};

function BottomSheet({ open, onOpenChange, title, children, className }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const offset = useAnimatedValue(0);
  const id = React.useId();
  React.useEffect(() => {
    if (open) offset.setValue(0);
  }, [open, offset]);
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && gesture.dy > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => offset.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80 || gesture.vy > 0.8) onOpenChange(false);
          else Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [offset, onOpenChange],
  );

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="bg-scrim flex-1"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0" onPress={() => onOpenChange(false)} aria-hidden />
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={() => onOpenChange(false)}
            role="dialog"
            aria-labelledby={id}
            className={cn('bg-base shadow-overlay max-h-[90%] rounded-t-lg px-4 pb-3', className)}
            style={{ transform: [{ translateY: offset }], paddingBottom: insets.bottom + 12 }}
          >
            <View
              className="h-7 items-center justify-center"
              {...panResponder.panHandlers}
              aria-hidden
            >
              <View className="bg-(--border-color-strong) h-1 w-10 rounded-full" />
            </View>
            <View className="mb-4 flex-row items-center gap-3">
              <Text nativeID={id} variant="heading-m" role="heading" className="flex-1">
                {title}
              </Text>
              <IconButton
                icon={X}
                accessibilityLabel="閉じる"
                onPress={() => onOpenChange(false)}
              />
            </View>
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-4"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export { BottomSheet };
