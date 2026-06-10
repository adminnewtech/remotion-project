import * as React from 'react';

import type { Locale } from '@elite/types';

import { formatKWD } from '../index';
import { cn } from './cn';

export interface PriceTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Regular price in KWD. */
  price: number;
  /**
   * Optional discounted price in KWD. When provided and lower than `price`,
   * it becomes the displayed price and `price` is shown struck through.
   */
  salePrice?: number | null;
  /**
   * Render inline (baseline-aligned, no block wrapping) for use inside table
   * cells and summary rows. Defaults to false.
   */
  inline?: boolean;
  /** @deprecated Alias for `price`. */
  amount?: number;
  /** @deprecated Alias for `salePrice` (original price struck through). */
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
 * Displays a KWD price (3 decimals) with an optional struck-through original
 * price when on sale. The container uses logical inline spacing so it lays out
 * correctly in both RTL (Arabic) and LTR (English).
 */
export function PriceTag({
  price,
  salePrice,
  inline = false,
  amount,
  compareAt,
  locale = 'ar',
  size = 'md',
  className,
  ...props
}: PriceTagProps) {
  // Resolve the regular price, honouring the deprecated `amount` alias.
  const regular = price ?? amount ?? 0;
  // The discounted price may arrive via `salePrice` or the deprecated
  // `compareAt` alias.
  const sale = salePrice ?? compareAt ?? null;
  const onSale = typeof sale === 'number' && sale < regular;
  const current = onSale ? (sale as number) : regular;

  return (
    <span
      className={cn(
        'items-baseline gap-2',
        inline ? 'inline-flex' : 'flex',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <span className={cn('font-semibold text-foreground', onSale && 'text-danger')}>
        {formatKWD(current, locale)}
      </span>
      {onSale && (
        <span className="text-sm font-normal text-muted line-through">
          {formatKWD(regular, locale)}
        </span>
      )}
    </span>
  );
}
