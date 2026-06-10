import * as React from 'react';

import { cn } from './cn';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Optional count/badge shown beside the label. */
  badge?: React.ReactNode;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Visual style of the tab list. */
  variant?: 'underline' | 'pill';
  /** Stretch tabs to fill the row. */
  fullWidth?: boolean;
}

const listClasses = {
  underline: 'border-b border-border gap-1',
  pill: 'gap-1 rounded-lg bg-neutral-100 p-1',
} as const;

/**
 * Accessible tab strip (role=tablist). RTL-correct: relies on flex flow so the
 * order follows the document direction. Controlled via `value`/`onValueChange`.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  variant = 'underline',
  fullWidth = false,
  className,
  ...props
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn('flex items-center', listClasses[variant], className)}
      {...props}
    >
      {items.map((item) => {
        const active = item.value === value;
        const base =
          variant === 'pill'
            ? cn(
                'rounded-md',
                active
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground',
              )
            : cn(
                '-mb-px border-b-2',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground',
              );
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              'disabled:pointer-events-none disabled:opacity-50',
              fullWidth && 'flex-1',
              base,
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
