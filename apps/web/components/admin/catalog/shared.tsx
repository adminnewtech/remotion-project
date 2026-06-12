'use client';

/**
 * Shared OSALPHA catalog primitives — number/money formatters, a self-contained
 * toast (the admin shell has no ToastProvider), the gold "+ منتج جديد" button,
 * a low-stock status pill, and a money cell. All token-driven and RTL-safe.
 */
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ── Number / money formatting ───────────────────────────────

/** Western-digit integer with thousands separators. */
export function int(n: number): string {
  return n.toLocaleString('en-US');
}

/** KWD, 3 decimals, thousands-separated (the OSALPHA money convention). */
export function kwd(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Money cell: mono `.num`, strikethrough regular when on sale + faint د.ك. */
export function Money({
  price,
  salePrice,
  align = 'end',
}: {
  price: number;
  salePrice?: number | null;
  align?: 'start' | 'end';
}) {
  const onSale = salePrice != null && salePrice < price;
  return (
    <span className={`flex flex-col ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <span className="num flex items-baseline gap-1 text-[13px] font-semibold text-osa-ink">
        {kwd(onSale ? (salePrice as number) : price)}
        <span className="text-[10.5px] font-semibold text-osa-faint">د.ك</span>
      </span>
      {onSale && (
        <span className="num text-[11px] text-osa-faint line-through">{kwd(price)}</span>
      )}
    </span>
  );
}

// ── Low-stock pill ──────────────────────────────────────────

export function StockPill({ stock, threshold = 5 }: { stock: number; threshold?: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-osa-rose-dim px-[10px] py-[3px] text-[11.5px] font-semibold text-osa-rose">
        <i className="inline-block h-1.5 w-1.5 rounded-full bg-osa-rose" aria-hidden />
        نفد
        <span className="num">{int(stock)}</span>
      </span>
    );
  }
  if (stock <= threshold) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-osa-amber-dim px-[10px] py-[3px] text-[11.5px] font-semibold text-osa-amber">
        <i className="inline-block h-1.5 w-1.5 rounded-full bg-osa-amber" aria-hidden />
        منخفض
        <span className="num">{int(stock)}</span>
      </span>
    );
  }
  return <span className="num text-[13px] font-medium text-osa-ink">{int(stock)}</span>;
}

// ── Status toggle (نشط / مخفي) ──────────────────────────────

export function StatusToggle({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? 'نشط' : 'مخفي'}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={
          'relative inline-block h-[18px] w-[32px] flex-shrink-0 rounded-full transition-colors ' +
          (active ? 'bg-osa-green' : 'bg-osa-surface-2 border border-osa-border-strong')
        }
      >
        <span
          className={
            'absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all ' +
            (active ? 'end-[2px]' : 'start-[2px]')
          }
        />
      </span>
      <span className={'text-[12px] font-semibold ' + (active ? 'text-osa-green' : 'text-osa-muted')}>
        {active ? 'نشط' : 'مخفي'}
      </span>
    </button>
  );
}

// ── Gold primary button ─────────────────────────────────────

export function GoldButton({
  children,
  onClick,
  type = 'button',
  disabled,
  loading,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={
        'osa-btn-primary inline-flex items-center justify-center gap-2 rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97] disabled:opacity-60 ' +
        className
      }
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center justify-center gap-2 rounded-full border border-osa-border-strong bg-osa-surface px-5 py-[9px] text-[13.5px] font-semibold text-osa-muted transition-colors hover:bg-osa-surface-2 disabled:opacity-60 ' +
        className
      }
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Toast (self-contained for the admin shell) ──────────────

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  undo?: () => void;
}
interface ToastCtx {
  toast: (message: string, opts?: { tone?: ToastTone; undo?: () => void }) => void;
}
const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <CatalogToastProvider>');
  return ctx;
}

export function CatalogToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastCtx['toast']>(
    (message, opts) => {
      const id = ++idRef.current;
      setItems((xs) => [...xs, { id, message, tone: opts?.tone ?? 'success', undo: opts?.undo }]);
      window.setTimeout(() => remove(id), opts?.undo ? 6000 : 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-[60px] start-5 z-50 flex flex-col gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="pointer-events-auto flex items-center gap-3 rounded-osa-sm border border-osa-border bg-osa-surface px-4 py-3 text-[13px] text-osa-ink shadow-osa"
            role="status"
            aria-live="polite"
          >
            <i
              className={
                'inline-block h-2 w-2 flex-shrink-0 rounded-full ' +
                (it.tone === 'error' ? 'bg-osa-rose' : it.tone === 'info' ? 'bg-osa-blue' : 'bg-osa-green')
              }
              aria-hidden
            />
            <span>{it.message}</span>
            {it.undo && (
              <button
                type="button"
                onClick={() => {
                  it.undo?.();
                  remove(it.id);
                }}
                className="ms-2 text-[12px] font-semibold text-osa-brand"
              >
                تراجع
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
