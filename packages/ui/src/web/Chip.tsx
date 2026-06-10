import * as React from 'react';

import { cn } from './cn';

export interface ChipProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Toggled/active state (filter selected). */
  selected?: boolean;
  /** When provided, shows a remove (×) affordance and calls this on click. */
  onRemove?: () => void;
  removeLabel?: string;
  leadingIcon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Compact selectable token used for filters, applied facets, and quick picks.
 * Renders as a button (interactive). Pass `onRemove` for a dismissible
 * "applied filter" chip. RTL-safe via logical spacing.
 */
export function Chip({
  selected = false,
  onRemove,
  removeLabel = 'Remove',
  leadingIcon,
  disabled,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-primary bg-primary-50 text-primary-700'
          : 'border-border bg-surface text-foreground hover:bg-neutral-50',
        className,
      )}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-me-1 inline-flex rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </span>
      )}
    </button>
  );
}

/** Alias for clarity at filter call sites. Identical behavior to <Chip>. */
export const FilterChip = Chip;
export type FilterChipProps = ChipProps;
