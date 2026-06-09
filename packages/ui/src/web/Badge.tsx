import * as React from 'react';

import type { StatusTone } from '../status';
import { cn } from './cn';

export type BadgeTone = StatusTone;
export type BadgeVariant = 'solid' | 'soft' | 'outline';

/** soft (default) tone classes — subtle bg + readable text. */
const softClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  info: 'bg-info-100 text-info-700',
  primary: 'bg-primary-100 text-primary-700',
  accent: 'bg-accent-100 text-accent-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
};

const solidClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-600 text-white',
  info: 'bg-info text-info-foreground',
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-danger text-danger-foreground',
};

const outlineClasses: Record<BadgeTone, string> = {
  neutral: 'border border-neutral-300 text-neutral-700',
  info: 'border border-info-500 text-info-700',
  primary: 'border border-primary-500 text-primary-700',
  accent: 'border border-accent-500 text-accent-700',
  success: 'border border-success-500 text-success-700',
  warning: 'border border-warning-500 text-warning-700',
  danger: 'border border-danger-500 text-danger-700',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const toneClasses =
    variant === 'solid' ? solidClasses[tone] : variant === 'outline' ? outlineClasses[tone] : softClasses[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses,
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
