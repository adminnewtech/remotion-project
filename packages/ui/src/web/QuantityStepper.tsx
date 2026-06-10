import * as React from 'react';

import { cn } from './cn';

export interface QuantityStepperProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: 'sm' | 'md';
  disabled?: boolean;
  decrementLabel?: string;
  incrementLabel?: string;
}

const sizeClasses = {
  sm: { btn: 'h-7 w-7', field: 'h-7 w-9 text-sm' },
  md: { btn: 'h-9 w-9', field: 'h-9 w-12 text-sm' },
} as const;

/**
 * Numeric stepper for cart quantities. The +/- buttons keep a fixed visual
 * order; because they are labelled (not directional arrows) the layout reads
 * correctly under both RTL and LTR. Clamps to [min, max].
 */
export function QuantityStepper({
  value,
  onValueChange,
  min = 1,
  max = 99,
  step = 1,
  size = 'md',
  disabled = false,
  decrementLabel = 'Decrease quantity',
  incrementLabel = 'Increase quantity',
  className,
  ...props
}: QuantityStepperProps) {
  const s = sizeClasses[size];
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => onValueChange(clamp(n));

  const btn =
    'inline-flex items-center justify-center text-foreground transition-colors hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-md border border-border bg-surface',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        aria-label={decrementLabel}
        className={cn(btn, s.btn)}
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantity"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          if (!Number.isNaN(n)) set(n);
        }}
        className={cn(
          'border-x border-border bg-transparent text-center font-medium text-foreground outline-none',
          s.field,
        )}
      />
      <button
        type="button"
        aria-label={incrementLabel}
        className={cn(btn, s.btn)}
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
