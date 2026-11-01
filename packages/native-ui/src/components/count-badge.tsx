import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Text } from './text';

function CountBadge({
  count,
  className,
  ...props
}: React.ComponentProps<typeof View> & { count: number }) {
  return (
    <View
      className={cn(
        'bg-accent h-6 min-w-6 items-center justify-center self-start rounded-full px-1.5',
        className,
      )}
      {...props}
    >
      <Text variant="label-m" className="tabular-nums">
        {count}
      </Text>
    </View>
  );
}

export { CountBadge };
