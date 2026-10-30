import * as LabelPrimitive from '@rn-primitives/label';
import * as React from 'react';

import { cn } from '../cn';

function Label({
  className,
  disabled,
  onPress,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Text> & { disabled?: boolean }) {
  return (
    <LabelPrimitive.Root disabled={disabled} onPress={onPress}>
      <LabelPrimitive.Text
        className={cn(
          'text-label-m text-primary font-sans-bold',
          disabled && 'text-disabled',
          className,
        )}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}

export { Label };
