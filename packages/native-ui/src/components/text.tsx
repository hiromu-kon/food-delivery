import * as React from 'react';
import { Text as RNText } from 'react-native';

import { cn } from '../cn';

// React Native は書体の太さを切り替えられないため、文字のトークンごとに太さに合った書体を選ぶ
const variantClassNames = {
  display: 'text-display font-display',
  'heading-l': 'text-heading-l font-sans-bold',
  'heading-m': 'text-heading-m font-sans-bold',
  'body-l': 'text-body-l font-sans-medium',
  'body-m': 'text-body-m font-sans',
  'body-s': 'text-body-s font-sans',
  'label-l': 'text-label-l font-sans-bold',
  'label-m': 'text-label-m font-sans-bold',
  'label-s': 'text-label-s font-sans-bold',
} as const;

type TextVariant = keyof typeof variantClassNames;

// Button のように、中の文字の見た目を親が決める部品のために使う
const TextClassContext = React.createContext<string | undefined>(undefined);

type TextProps = React.ComponentProps<typeof RNText> & {
  variant?: TextVariant;
};

function Text({ variant = 'body-m', className, ...props }: TextProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <RNText
      className={cn('text-primary', variantClassNames[variant], textClass, className)}
      {...props}
    />
  );
}

export { Text, TextClassContext, type TextVariant, variantClassNames };
