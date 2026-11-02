import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { withUniwind } from 'uniwind';

import { cn } from '../cn';

const StyledActivityIndicator = withUniwind(ActivityIndicator, {
  color: { fromClassName: 'className', styleProperty: 'color' },
});

function Spinner({
  className,
  accessibilityLabel = '読み込み中',
  ...props
}: React.ComponentProps<typeof View>) {
  return (
    <View
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      className={cn('size-8 items-center justify-center', className)}
      {...props}
    >
      <StyledActivityIndicator size="large" className="text-brand" aria-hidden />
    </View>
  );
}

export { Spinner };
