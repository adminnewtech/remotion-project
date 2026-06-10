import * as React from 'react';

import type { StatusTone } from '../status';
import { cn } from './cn';

export type AlertTone = Extract<StatusTone, 'info' | 'success' | 'warning' | 'danger'> | 'neutral';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  /** When provided, renders a dismiss button that calls this handler. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

const toneClasses: Record<AlertTone, string> = {
  neutral: 'bg-neutral-50 border-neutral-200 text-neutral-800',
  info: 'bg-info-50 border-info-100 text-info-700',
  success: 'bg-success-50 border-success-100 text-success-700',
  warning: 'bg-warning-50 border-warning-100 text-warning-700',
  danger: 'bg-danger-50 border-danger-100 text-danger-700',
};

/**
 * Inline contextual message (banner). For transient stacked notifications use
 * <Toast>/<ToastProvider>. RTL-safe via logical layout.
 */
export function Alert({
  tone = 'info',
  title,
  icon,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="-m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
