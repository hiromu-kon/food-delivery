import { cn } from '@repo/native-ui/cn';
import { Text } from '@repo/native-ui/text';
import * as React from 'react';
import { View } from 'react-native';

type StoreNorenProps = React.ComponentProps<typeof View> & { name: string; description?: string };

function StoreNoren({ name, description, className, ...props }: StoreNorenProps) {
  return (
    <View
      className={cn('bg-brand min-h-31 overflow-hidden rounded-t-xs px-6 pt-5 pb-8', className)}
      {...props}
    >
      <Text variant="display" role="heading" className="text-on-brand">
        {name}
      </Text>
      {description && (
        <Text variant="body-s" className="text-on-brand-subtle mt-2">
          {description}
        </Text>
      )}
      <View className="absolute inset-x-0 bottom-0 h-5.5 flex-row" aria-hidden>
        <View className="border-(--background-color-base) flex-1 border-r-2" />
        <View className="border-(--background-color-base) flex-1 border-x-2" />
        <View className="border-(--background-color-base) flex-1 border-l-2" />
      </View>
    </View>
  );
}

export { StoreNoren };
