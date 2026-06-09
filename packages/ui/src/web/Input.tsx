import * as React from 'react';

import { cn } from './cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Rendered at the inline-start (RTL-aware). */
  startAdornment?: React.ReactNode;
  /** Rendered at the inline-end (RTL-aware). */
  endAdornment?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, startAdornment, endAdornment, containerClassName, className, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const invalid = Boolean(error);

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-surface px-3',
          'focus-within:ring-2 focus-within:ring-primary',
          invalid ? 'border-danger focus-within:ring-danger' : 'border-border',
        )}
      >
        {startAdornment && <span className="text-muted">{startAdornment}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            'h-10 w-full bg-transparent text-sm text-foreground outline-none',
            'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        {endAdornment && <span className="text-muted">{endAdornment}</span>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
