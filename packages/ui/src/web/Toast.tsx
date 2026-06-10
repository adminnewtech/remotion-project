import * as React from 'react';

import { cn } from './cn';
import { Alert, type AlertTone } from './Alert';

export interface ToastOptions {
  id?: string;
  tone?: AlertTone;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Auto-dismiss after this many ms (default 4000). 0 = sticky. */
  duration?: number;
}

interface ToastRecord extends Required<Pick<ToastOptions, 'id'>>, ToastOptions {}

export interface ToastContextValue {
  /** Enqueue a toast; returns its id. */
  toast: (options: ToastOptions) => string;
  /** Dismiss a toast early by id. */
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Access the toast queue. Must be used within <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

export interface ToastProviderProps {
  children?: React.ReactNode;
  /** Corner placement of the stack. RTL-aware: start/end follow direction. */
  placement?: 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
}

const placementClasses: Record<NonNullable<ToastProviderProps['placement']>, string> = {
  'top-start': 'top-4 start-4',
  'top-end': 'top-4 end-4',
  'bottom-start': 'bottom-4 start-4',
  'bottom-end': 'bottom-4 end-4',
};

let counter = 0;

/**
 * Provides the toast queue + renders the stack in a fixed corner. Mount once
 * near the app root, then call `useToast().toast(...)` from anywhere.
 */
export function ToastProvider({ children, placement = 'bottom-end' }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? `toast-${++counter}`;
      const record: ToastRecord = { ...options, id };
      setToasts((prev) => [...prev.filter((t) => t.id !== id), record]);
      const duration = options.duration ?? 4000;
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const map = timers.current;
    return () => {
      Object.values(map).forEach(clearTimeout);
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={cn(
          'pointer-events-none fixed z-[60] flex w-full max-w-sm flex-col gap-2',
          placementClasses[placement],
        )}
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <Alert
            key={t.id}
            tone={t.tone ?? 'neutral'}
            title={t.title}
            onDismiss={() => dismiss(t.id)}
            className="pointer-events-auto shadow-lg"
          >
            {t.description}
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
