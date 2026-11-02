import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn } from '../cn';
import { Text } from './text';

type TabsProps = Omit<React.ComponentProps<typeof View>, 'children'> & {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string; disabled?: boolean; content: React.ReactNode }[];
};

function Tabs({ value, onValueChange, items, className, ...props }: TabsProps) {
  const id = React.useId();
  return (
    <View className={cn('gap-4', className)} {...props}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="bg-base border-default grow-0 border-b"
        contentContainerClassName="min-h-12 gap-6 px-4"
        role="tablist"
      >
        {items.map((item) => {
          const selected = value === item.value;
          return (
            <Pressable
              key={item.value}
              nativeID={`${id}-tab-${item.value}`}
              role="tab"
              accessibilityState={{ selected, disabled: Boolean(item.disabled) }}
              disabled={item.disabled}
              onPress={() => onValueChange(item.value)}
              className="justify-center"
            >
              <Text
                variant={selected ? 'label-m' : 'body-m'}
                className={
                  item.disabled ? 'text-disabled' : selected ? 'text-brand' : 'text-secondary'
                }
              >
                {item.label}
              </Text>
              {selected && (
                <View className="bg-brand absolute inset-x-0 bottom-0 h-0.75 rounded-full" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      {items.map(
        (item) =>
          item.value === value && (
            <View key={item.value} role="tabpanel" aria-labelledby={`${id}-tab-${item.value}`}>
              {item.content}
            </View>
          ),
      )}
    </View>
  );
}

export { Tabs, type TabsProps };
