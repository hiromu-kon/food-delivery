import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Text } from './text';

type ListItemProps = React.ComponentProps<typeof Pressable> & {
  title: string;
  description?: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  value?: string;
  chevron?: boolean;
  tone?: 'default' | 'danger';
};

function ListItem({
  title,
  description,
  icon,
  trailing,
  value,
  onPress,
  chevron = Boolean(onPress),
  tone = 'default',
  disabled,
  className,
  ...props
}: ListItemProps) {
  const color = disabled ? 'text-disabled' : tone === 'danger' ? 'text-danger' : 'text-primary';
  return (
    <Pressable
      role={onPress ? 'button' : undefined}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'bg-base border-default min-h-14 flex-row items-center gap-3 border-b px-4 py-3',
        onPress && !disabled && 'active:bg-subtle',
        className,
      )}
      {...props}
    >
      {icon && (
        <Icon as={icon} className={disabled ? 'text-disabled' : 'text-secondary'} aria-hidden />
      )}
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="body-l" className={color}>
          {title}
        </Text>
        {description && (
          <Text variant="body-s" className={disabled ? 'text-disabled' : 'text-secondary'}>
            {description}
          </Text>
        )}
      </View>
      {trailing}
      {value && <Text className={disabled ? 'text-disabled' : 'text-secondary'}>{value}</Text>}
      {chevron && (
        <Icon
          as={ChevronRight}
          className={disabled ? 'text-disabled' : 'text-secondary'}
          aria-hidden
        />
      )}
    </Pressable>
  );
}

export { ListItem };
