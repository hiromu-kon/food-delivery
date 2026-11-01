import * as SelectPrimitive from '@rn-primitives/select';
import { Check, ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { TextClassContext } from './text';

type Option = SelectPrimitive.Option;

const Select = SelectPrimitive.Root;

function SelectValue({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value> & { className?: string }) {
  const { value } = SelectPrimitive.useRootContext();
  return (
    <SelectPrimitive.Value
      className={cn(
        'text-body-l text-primary font-sans-medium',
        !value && 'text-secondary',
        className,
      )}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { children?: React.ReactNode }) {
  const { open } = SelectPrimitive.useRootContext();
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'border-strong bg-base h-12 flex-row items-center justify-between gap-2 rounded-sm border px-4',
        open && 'border-focus',
        props.disabled && 'border-default bg-subtle',
        className,
      )}
      {...props}
    >
      <TextClassContext.Provider value={props.disabled ? 'text-disabled' : undefined}>
        {children}
      </TextClassContext.Provider>
      <Icon
        as={ChevronDown}
        aria-hidden
        className={cn('text-secondary size-5', props.disabled && 'text-disabled')}
      />
    </SelectPrimitive.Trigger>
  );
}

// React Native Reusables は開閉に react-native-reanimated の動きを付けるが、依存を増やさないため動きは付けない
function SelectContent({
  className,
  children,
  portalHost,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  className?: string;
  portalHost?: string;
}) {
  return (
    <SelectPrimitive.Portal {...(portalHost && { hostName: portalHost })}>
      <SelectPrimitive.Overlay style={StyleSheet.absoluteFill}>
        <SelectPrimitive.Content
          className={cn(
            'border-default bg-base shadow-overlay z-50 rounded-sm border py-1',
            className,
          )}
          position="popper"
          sideOffset={4}
          {...props}
        >
          <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Overlay>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Item>, 'children'>) {
  const { value } = SelectPrimitive.useRootContext();
  const selected = value?.value === props.value;
  return (
    <SelectPrimitive.Item
      className={cn(
        'active:bg-subtle h-11 w-full flex-row items-center justify-between gap-2 px-4',
        selected && 'bg-brand-subtle',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText
        className={cn(
          'text-body-m font-sans',
          selected ? 'text-brand' : 'text-primary',
          props.disabled && 'text-disabled',
        )}
      />
      <View className="size-4.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Icon as={Check} className="text-brand size-4.5" />
        </SelectPrimitive.ItemIndicator>
      </View>
    </SelectPrimitive.Item>
  );
}

export { type Option, Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
