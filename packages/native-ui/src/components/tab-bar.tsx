import { Bike, House, ReceiptText, User, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Text } from './text';

const appTabs = {
  customer: [
    { value: 'home', label: 'ホーム', icon: House },
    { value: 'orders', label: '注文履歴', icon: ReceiptText },
    { value: 'account', label: 'アカウント', icon: User },
  ],
  courier: [
    { value: 'deliveries', label: '配達', icon: Bike },
    { value: 'history', label: '履歴', icon: ReceiptText },
    { value: 'account', label: 'アカウント', icon: User },
  ],
} satisfies Record<string, { value: string; label: string; icon: LucideIcon }[]>;

type TabBarProps = Omit<React.ComponentProps<typeof View>, 'children'> & {
  app: keyof typeof appTabs;
  value: string;
  onValueChange: (value: string) => void;
};

function TabBar({ app, value, onValueChange, className, ...props }: TabBarProps) {
  return (
    <View
      role="tablist"
      className={cn('bg-base border-default min-h-16 flex-row border-t', className)}
      {...props}
    >
      {appTabs[app].map((item) => {
        const selected = value === item.value;
        const color = selected ? 'text-brand' : 'text-secondary';
        return (
          <Pressable
            key={item.value}
            role="tab"
            accessibilityState={{ selected }}
            onPress={() => onValueChange(item.value)}
            className="active:bg-subtle flex-1 items-center justify-center gap-1 py-2"
          >
            <Icon as={item.icon} className={cn('size-5.5', color)} aria-hidden />
            <Text variant="body-s" className={cn(color, selected && 'font-sans-bold')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { TabBar };
