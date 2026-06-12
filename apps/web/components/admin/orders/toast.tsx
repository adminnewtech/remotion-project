'use client';

/**
 * Minimal OSALPHA-gold toast — self-contained so it doesn't depend on the
 * (currently unwired) global @elite/ui ToastProvider and re-themes under
 * `[data-theme]`. Bottom-start (logical) stack, auto-dismiss, RTL-safe.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';

interface ToastRecord {
  id: number;
  tone: Tone;
  message: ReactNode;
}

interface ToastApi {
  toast: (message: ReactNode, tone?: Tone) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function useOsaToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOsaToast must be used within <OsaToastProvider>');
  return ctx;
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'border-osa-green text-osa-green',
  error: 'border-osa-rose text-osa-rose',
  info: 'border-osa-brand-border text-osa-brand',
};

export function OsaToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: ReactNode, tone: Tone = 'success') => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 start-5 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-auto flex items-center gap-2.5 rounded-osa-sm border bg-osa-surface px-4 py-2.5 text-[13px] font-medium shadow-osa ' +
              TONE_CLASS[t.tone]
            }
          >
            <span aria-hidden>{t.tone === 'success' ? '✓' : t.tone === 'error' ? '!' : 'ℹ'}</span>
            <span className="text-osa-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
