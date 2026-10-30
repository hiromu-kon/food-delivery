import * as React from 'react';
import { TextInput } from 'react-native';

import { cn } from '../cn';

type InputProps = React.ComponentProps<typeof TextInput> & {
  invalid?: boolean;
};

function Input({
  className,
  invalid = false,
  editable = true,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      editable={editable}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      className={cn(
        'border-strong bg-base text-body-l text-primary font-sans-medium placeholder:text-secondary h-12 w-full rounded-sm border px-4',
        invalid && 'border-danger',
        // フォーカス中は Penpot と同じく 2px の枠にする。React Native には outline がないため枠の太さを変える
        focused && 'border-focus border-2 px-3.75',
        !editable && 'border-default bg-subtle text-disabled',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
