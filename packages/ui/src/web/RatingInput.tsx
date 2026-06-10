import * as React from 'react';

import { cn } from './cn';

export interface RatingInputProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  /** Accessible label for the rating group. */
  label?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
} as const;

function StarShape({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"
        className={filled ? 'fill-warning' : 'fill-neutral-200'}
      />
    </svg>
  );
}

/**
 * Interactive star input for writing a review. Supports hover preview and
 * keyboard (arrow keys). For read-only display of a score use <Rating> or
 * <Stars>. Whole-star values only (1..max).
 */
export function RatingInput({
  value,
  onValueChange,
  max = 5,
  size = 'md',
  disabled = false,
  label = 'Rating',
  className,
  ...props
}: RatingInputProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-1', className)}
      onMouseLeave={() => setHover(null)}
      {...props}
    >
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star}`}
            disabled={disabled}
            onMouseEnter={() => setHover(star)}
            onClick={() => onValueChange(star)}
            className={cn(
              'transition-transform disabled:pointer-events-none',
              !disabled && 'hover:scale-110',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded',
            )}
          >
            <StarShape filled={star <= shown} className={sizeClasses[size]} />
          </button>
        );
      })}
    </div>
  );
}
