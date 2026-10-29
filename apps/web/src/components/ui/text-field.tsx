import { CircleAlertIcon } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type TextFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  helperText?: string;
  errorMessage?: string;
};

function TextField({
  label,
  helperText,
  errorMessage,
  id,
  className,
  disabled,
  ...props
}: TextFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = errorMessage ?? helperText;

  return (
    <div
      data-slot="text-field"
      data-disabled={disabled}
      className={cn('group flex flex-col gap-2', className)}
    >
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        disabled={disabled}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...props}
      />
      {errorMessage ? (
        <p id={messageId} className="text-body-s text-danger flex items-center gap-1">
          <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
          {errorMessage}
        </p>
      ) : (
        helperText && (
          <p id={messageId} className="text-body-s text-secondary">
            {helperText}
          </p>
        )
      )}
    </div>
  );
}

export { TextField };
