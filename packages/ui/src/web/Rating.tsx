import * as React from 'react';

import { cn } from './cn';

export interface RatingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current value, 0–max (supports halves for display). */
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Optional review count to show beside the stars. */
  count?: number;
  /** When provided, stars become interactive (1..max). */
  onChange?: (value: number) => void;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

function Star({ fill, className }: { fill: number; className?: string }) {
  // fill: 0 = empty, 0.5 = half, 1 = full
  const clipId = React.useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={`${fill * 100}%`} height="100%" />
        </clipPath>
      </defs>
      <path
        d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"
        className="fill-neutral-200"
      />
      <path
        d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"
        className="fill-warning"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

/** Star rating display, optionally interactive when `onChange` is supplied. */
export function Rating({
  value,
  max = 5,
  size = 'md',
  count,
  onChange,
  className,
  ...props
}: RatingProps) {
  const interactive = typeof onChange === 'function';
  const stars = Array.from({ length: max }, (_, i) => {
    const fill = Math.max(0, Math.min(1, value - i));
    return fill;
  });

  return (
    <div className={cn('inline-flex items-center gap-1', className)} {...props}>
      <div className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'}>
        {stars.map((fill, i) =>
          interactive ? (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}`}
              onClick={() => onChange?.(i + 1)}
              className="transition-transform hover:scale-110"
            >
              <Star fill={fill} className={sizeClasses[size]} />
            </button>
          ) : (
            <Star key={i} fill={fill} className={sizeClasses[size]} />
          ),
        )}
      </div>
      {typeof count === 'number' && <span className="text-sm text-muted">({count})</span>}
    </div>
  );
}
