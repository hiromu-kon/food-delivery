import { CircleAlert } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { cn } from '../cn';
import { Icon } from './icon';
import { Input } from './input';
import { Label } from './label';
import { Text } from './text';

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  helperText?: string;
  errorMessage?: string;
  containerClassName?: string;
};

function TextField({
  label,
  helperText,
  errorMessage,
  editable = true,
  containerClassName,
  ...props
}: TextFieldProps) {
  const inputRef = React.useRef<React.ComponentRef<typeof Input>>(null);
  return (
    <View className={cn('gap-2', containerClassName)}>
      <Label disabled={!editable} onPress={() => inputRef.current?.focus()}>
        {label}
      </Label>
      <Input
        ref={inputRef}
        accessibilityLabel={label}
        accessibilityHint={errorMessage ?? helperText}
        editable={editable}
        invalid={Boolean(errorMessage)}
        {...props}
      />
      {errorMessage ? (
        <View className="flex-row items-center gap-1">
          <Icon as={CircleAlert} className="text-danger size-4" />
          <Text variant="body-s" className="text-danger flex-1">
            {errorMessage}
          </Text>
        </View>
      ) : (
        helperText && (
          <Text variant="body-s" className="text-secondary">
            {helperText}
          </Text>
        )
      )}
    </View>
  );
}

export { TextField };
