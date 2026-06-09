import * as React from 'react';

import type { Locale } from '@elite/types';

import { formatKWD } from '../index';
import { cn } from './cn';

export interface PriceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Current price in KWD. */
  amount: number;
  /** Optional original price (struck through) when on sale. */
  compareAt?: number | null;
  locale?: Locale;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
} as const;

/**
 * Displays a KWD price (3 decimals) with optional strike-through compare-at
 * price. The container uses logical inline spacing so it lays out correctly
 * in both RTL (Arabic) and LTR (English).
 */
export function PriceTag({
  amount,
  compareAt,
  locale = 'ar',
  size = 'md',
  className,
  ...props
}: PriceTagProps) {
  const onSale = typeof compareAt === 'number' && compareAt > amount;
  return (
    <span className={cn('inline-flex items-baseline gap-2', sizeClasses[size], className)} {...props}>
      <span className={cn('font-semibold text-foreground', onSale && 'text-danger')}>
        {formatKWD(amount, locale)}
      </span>
      {onSale && (
        <span className="text-sm font-normal text-muted line-through">
          {formatKWD(compareAt, locale)}
        </span>
      )}
    </span>
  );
}
