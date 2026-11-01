import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { withUniwind } from 'uniwind';

import { cn } from '../cn';
import { Text, TextClassContext } from './text';

const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-md border', {
  variants: {
    variant: {
      primary: 'bg-brand active:bg-brand-hover border-transparent',
      secondary: 'border-strong bg-base active:bg-subtle',
      ghost: 'active:bg-brand-subtle border-transparent',
      danger: 'bg-danger active:bg-danger-hover border-transparent',
    },
    size: {
      L: 'h-12 px-5',
      M: 'h-10 px-4',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'L',
  },
});

const buttonTextVariants = cva('', {
  variants: {
    variant: {
      primary: 'text-on-brand',
      secondary: 'text-primary',
      ghost: 'text-brand',
      danger: 'text-on-brand',
    },
    size: {
      L: 'text-label-l font-sans-bold',
      M: 'text-label-m font-sans-bold',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'L',
  },
});

const disabledClassNames = {
  primary: 'bg-disabled',
  secondary: 'border-default',
  ghost: '',
  danger: 'bg-disabled',
} as const;

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    children: React.ReactNode;
  };

function Button({
  variant = 'primary',
  size = 'L',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const variantKey = variant ?? 'primary';
  // 処理中は押せなくするが、色は種類のままにして処理中であることを伝える
  const showDisabled = Boolean(disabled) && !loading;
  return (
    <TextClassContext.Provider
      value={cn(buttonTextVariants({ variant, size }), showDisabled && 'text-disabled')}
    >
      <Pressable
        role="button"
        disabled={Boolean(disabled) || loading}
        aria-busy={loading}
        className={cn(
          buttonVariants({ variant, size }),
          showDisabled && disabledClassNames[variantKey],
          className,
        )}
        {...props}
      >
        {loading && <ButtonSpinner />}
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

// ActivityIndicator は className を解釈しないため、色を className から props に移す
const StyledActivityIndicator = withUniwind(ActivityIndicator, {
  color: { fromClassName: 'className', styleProperty: 'color' },
});

function ButtonSpinner() {
  const textClass = React.useContext(TextClassContext);
  return <StyledActivityIndicator size="small" className={textClass ?? ''} />;
}

export { Button, buttonTextVariants, buttonVariants };
