import { CircleAlert, Info } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Text, TextClassContext } from './text';

const tones = {
  info: { background: 'bg-brand-subtle', color: 'text-brand', icon: Info },
  warning: { background: 'bg-warning-subtle', color: 'text-warning', icon: CircleAlert },
  danger: { background: 'bg-danger-subtle', color: 'text-danger', icon: CircleAlert },
};

function NoticeBanner({
  tone = 'info',
  children,
  className,
  ...props
}: React.ComponentProps<typeof View> & { tone?: keyof typeof tones }) {
  const { background, color, icon } = tones[tone];
  return (
    <TextClassContext.Provider value={color}>
      <View
        className={cn('flex-row items-center gap-2 rounded-sm px-4 py-3', background, className)}
        {...props}
      >
        <Icon as={icon} className="size-4.5" aria-hidden />
        <View className="min-w-0 flex-1">
          {typeof children === 'string' ? <Text>{children}</Text> : children}
        </View>
      </View>
    </TextClassContext.Provider>
  );
}

export { NoticeBanner };
