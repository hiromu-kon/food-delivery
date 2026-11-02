import { ArrowLeft } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { IconButton } from './icon-button';
import { Text } from './text';

type AppHeaderProps = React.ComponentProps<typeof View> & {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

// セーフエリアは画面側で確保し、Expo Router のヘッダーとも二重に余白を取らない
function AppHeader({ title, onBack, right, className, ...props }: AppHeaderProps) {
  return (
    <View
      className={cn(
        'bg-base border-default min-h-14 flex-row items-center gap-2 border-b px-2 py-2',
        className,
      )}
      {...props}
    >
      <View className="size-10 items-center justify-center">
        {onBack && <IconButton icon={ArrowLeft} accessibilityLabel="戻る" onPress={onBack} />}
      </View>
      <Text variant="heading-m" role="heading" className="flex-1 text-center">
        {title}
      </Text>
      <View className="size-10 items-center justify-center">{right}</View>
    </View>
  );
}

export { AppHeader };
