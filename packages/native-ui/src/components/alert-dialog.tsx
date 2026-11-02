import * as React from 'react';
import { Modal, ScrollView, View } from 'react-native';

import { Button } from './button';
import { Text } from './text';

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onAction: () => void;
  loading?: boolean;
};

// Modal で背後の操作・読み上げを遮断し、外側を押しても確定操作を取り消さない
function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  cancelLabel = '戻る',
  variant = 'primary',
  onAction,
  loading = false,
}: AlertDialogProps) {
  const id = React.useId();
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) onOpenChange(false);
      }}
    >
      <View className="bg-scrim flex-1 items-center justify-center p-4" accessibilityViewIsModal>
        <View
          role="alertdialog"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          className="bg-base shadow-overlay max-h-full w-full max-w-85 gap-4 rounded-lg p-6"
        >
          <ScrollView bounces={false} contentContainerClassName="gap-4">
            <Text nativeID={`${id}-title`} variant="heading-m" role="heading">
              {title}
            </Text>
            <Text nativeID={`${id}-description`} className="text-secondary">
              {description}
            </Text>
          </ScrollView>
          <View className="flex-row flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              size="M"
              disabled={loading}
              onPress={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button variant={variant} size="M" loading={loading} onPress={onAction}>
              {actionLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export { AlertDialog, type AlertDialogProps };
