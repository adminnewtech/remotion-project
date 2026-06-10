import * as React from 'react';

import { cn } from './cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Convenience shape presets. */
  variant?: 'rect' | 'text' | 'circle';
}

const variantClasses = {
  rect: 'rounded-md',
  text: 'h-4 rounded',
  circle: 'rounded-full',
} as const;

/**
 * Generic shimmering placeholder for loading states. Size via Tailwind
 * width/height utility classes passed through `className`.
 */
export function Skeleton({ variant = 'rect', className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse bg-neutral-200', variantClasses[variant], className)}
      {...props}
    />
  );
}

export interface ProductCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Loading placeholder that mirrors the storefront product card layout
 * (image, title lines, price, button). RTL-safe — uses logical flow only.
 */
export function ProductCardSkeleton({ className, ...props }: ProductCardSkeletonProps) {
  return (
    <div
      className={cn('flex flex-col gap-3 rounded-lg border border-border bg-surface p-3', className)}
      {...props}
    >
      <Skeleton className="aspect-square w-full" />
      <Skeleton variant="text" className="w-3/4" />
      <Skeleton variant="text" className="w-1/2" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-1 h-9 w-full" />
    </div>
  );
}
