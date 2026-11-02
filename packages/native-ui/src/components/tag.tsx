import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Text } from './text';

function Tag({
  tone = 'neutral',
  children,
  className,
  ...props
}: React.ComponentProps<typeof View> & { tone?: 'neutral' | 'warning'; children: string }) {
  return (
    <View
      className={cn(
        'h-4.5 items-center justify-center self-start rounded-xs px-2',
        tone === 'neutral' ? 'bg-disabled' : 'bg-warning-subtle',
        className,
      )}
      {...props}
    >
      <Text variant="label-s" className={tone === 'neutral' ? 'text-secondary' : 'text-warning'}>
        {children}
      </Text>
    </View>
  );
}

export { Tag };
