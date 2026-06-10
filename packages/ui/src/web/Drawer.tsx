import * as React from 'react';

import { cn } from './cn';

export type DrawerSide = 'start' | 'end' | 'bottom';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Which edge the panel slides from. `start`/`end` are RTL-aware. */
  side?: DrawerSide;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  className?: string;
}

const sideClasses: Record<DrawerSide, string> = {
  start: 'inset-y-0 start-0 h-full border-e',
  end: 'inset-y-0 end-0 h-full border-s',
  bottom: 'inset-x-0 bottom-0 w-full rounded-t-2xl border-t',
};

const sizeClasses = {
  sm: { side: 'w-72', bottom: 'max-h-[40vh]' },
  md: { side: 'w-80 sm:w-96', bottom: 'max-h-[60vh]' },
  lg: { side: 'w-96 sm:w-[28rem]', bottom: 'max-h-[80vh]' },
} as const;

/**
 * Slide-over panel (a.k.a. Sheet) for filters, cart, mobile nav, etc.
 * `side="start|end"` follow the document direction so they open from the
 * correct edge in both Arabic (RTL) and English (LTR). Closes on Escape/backdrop.
 */
export function Drawer({
  open,
  onClose,
  side = 'end',
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className,
}: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dimension = side === 'bottom' ? sizeClasses[size].bottom : sizeClasses[size].side;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={cn(
          'absolute flex flex-col bg-surface shadow-xl border-border',
          sideClasses[side],
          dimension,
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-2 border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-1 rounded p-1 text-muted transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}

/** Alias — same component, "Sheet" naming used by some call sites. */
export const Sheet = Drawer;
export type SheetProps = DrawerProps;
