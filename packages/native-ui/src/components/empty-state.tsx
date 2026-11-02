import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Text } from './text';

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<typeof View> & {
  icon: LucideIcon;
  title: string;
  description?: string;
  action: React.ReactNode;
}) {
  return (
    <View className={cn('items-center gap-3 px-6 py-8', className)} {...props}>
      <Icon as={icon} className="text-disabled size-10" aria-hidden />
      <Text variant="heading-m" className="text-center">
        {title}
      </Text>
      {description && <Text className="text-secondary text-center">{description}</Text>}
      {action}
    </View>
  );
}

export { EmptyState };
