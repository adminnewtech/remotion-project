/**
 * @elite/ui/web — OSALPHA "Gold" admin primitives.
 *
 * Small, dependency-light building blocks for the gold admin design system
 * (shell + overview). They use the `osa-*` Tailwind tokens (CSS-var backed),
 * so they re-theme automatically under `[data-theme="dark"]`. All are RTL-safe
 * (logical properties only) and honor `prefers-reduced-motion` via the global
 * transition reset.
 */
import * as React from 'react';

import { cn } from './cn';

// ── StatusPill ──────────────────────────────────────────────
export type StatusTone = 'new' | 'prep' | 'done' | 'late' | 'brand' | 'neutral';

const STATUS_TONES: Record<StatusTone, string> = {
  new: 'bg-osa-blue-dim text-osa-blue',
  prep: 'bg-osa-brand-dim text-osa-brand',
  done: 'bg-osa-green-dim text-osa-green',
  late: 'bg-osa-amber-dim text-osa-amber',
  brand: 'bg-osa-brand-dim text-osa-brand',
  neutral: 'bg-osa-surface-2 text-osa-muted',
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

/** Rounded status pill (order/task state). Color is paired with a label. */
export function StatusPill({ tone = 'neutral', className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full px-3 py-[3px] text-[11.5px] font-semibold',
        STATUS_TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ── PayChip ─────────────────────────────────────────────────
export interface PayChipProps extends React.HTMLAttributes<HTMLSpanElement> {}

/** Outlined payment-method chip (KNET / Cash / Tabby …). */
export function PayChip({ className, children, ...props }: PayChipProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-md border border-osa-border-strong px-2 py-px text-[11px] font-semibold text-osa-muted',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ── ProgressBar ─────────────────────────────────────────────
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 fill percent. */
  value: number;
  /** Track height in px (default 4 for product bars; 6 for workshop bays). */
  height?: number;
  /** Fill color token. */
  tone?: 'brand' | 'aqua';
}

/** Thin progress / share bar with a rounded track. */
export function ProgressBar({ value, height = 4, tone = 'brand', className, ...props }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('overflow-hidden rounded-full bg-osa-surface-2', className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn('h-full rounded-full', tone === 'aqua' ? 'bg-osa-aqua' : 'bg-osa-brand')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Sparkline / area chart ──────────────────────────────────
export interface SparkSeries {
  /** Data points (y values). */
  points: number[];
  /** Stroke color (CSS color). */
  color: string;
  /** Stroke width (default 1.8). */
  width?: number;
  /** Fill a gradient area under the line (the primary series). */
  area?: boolean;
  /** Line opacity. */
  opacity?: number;
}

export interface SparklineProps extends React.SVGProps<SVGSVGElement> {
  series: SparkSeries[];
  /** Viewport width / height for the path math (not the rendered px size). */
  vbWidth?: number;
  vbHeight?: number;
  /** Draw 3 horizontal grid lines. */
  grid?: boolean;
  /** Highlight the latest point of the first `area` series with a halo dot. */
  marker?: boolean;
}

/**
 * Lightweight inline SVG line/area chart — no chart library. Each series is
 * normalized to the same min/max so trends are comparable. Smooth-ish via a
 * Catmull-Rom→cubic conversion. Used by the sales-by-channel card.
 */
export function Sparkline({
  series,
  vbWidth = 600,
  vbHeight = 180,
  grid = true,
  marker = true,
  className,
  ...props
}: SparklineProps) {
  const all = series.flatMap((s) => s.points);
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;
  // Leave headroom so the line doesn't touch the edges.
  const pad = vbHeight * 0.12;

  type Pt = { x: number; y: number };

  const toXY = (pts: number[]): Pt[] =>
    pts.map((v, i) => ({
      x: pts.length > 1 ? (i / (pts.length - 1)) * vbWidth : 0,
      y: vbHeight - pad - ((v - min) / span) * (vbHeight - pad * 2),
    }));

  const smoothPath = (xy: Pt[]): string => {
    const first = xy[0];
    if (!first) return '';
    if (xy.length === 1) return `M ${first.x} ${first.y}`;
    let d = `M ${first.x} ${first.y}`;
    const at = (i: number): Pt => xy[Math.max(0, Math.min(xy.length - 1, i))]!;
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = at(i - 1);
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = at(i + 2);
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const gid = React.useId().replace(/:/g, '');

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${vbHeight}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      {...props}
    >
      <defs>
        {series.map((s, i) =>
          s.area ? (
            <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.18" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ) : null,
        )}
      </defs>

      {grid && (
        <g stroke="var(--osa-border)">
          <line x1="0" y1={vbHeight * 0.2} x2={vbWidth} y2={vbHeight * 0.2} />
          <line x1="0" y1={vbHeight * 0.46} x2={vbWidth} y2={vbHeight * 0.46} />
          <line x1="0" y1={vbHeight * 0.72} x2={vbWidth} y2={vbHeight * 0.72} />
        </g>
      )}

      {series.map((s, i) => {
        const xy = toXY(s.points);
        const line = smoothPath(xy);
        const last = xy[xy.length - 1];
        return (
          <g key={i}>
            {s.area && (
              <path
                d={`${line} L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
                fill={`url(#${gid}-${i})`}
                stroke="none"
              />
            )}
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.opacity ?? 1}
              vectorEffect="non-scaling-stroke"
            />
            {marker && s.area && last && (
              <>
                <circle cx={last.x} cy={last.y} r="7" fill={s.color} opacity="0.18" />
                <circle cx={last.x} cy={last.y} r="3.5" fill={s.color} />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Checklist ───────────────────────────────────────────────
export interface ChecklistItem {
  id: string;
  label: React.ReactNode;
  done?: boolean;
  /** Right-aligned meta (assignee). */
  who?: React.ReactNode;
}

export interface ChecklistProps {
  items: ChecklistItem[];
  className?: string;
}

/** Read-only today-tasks checklist (matches the reference mockup). */
export function Checklist({ items, className }: ChecklistProps) {
  return (
    <div className={className}>
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-3 border-b border-osa-border py-[8.5px] text-[13px] last:border-none"
        >
          <span
            className={cn(
              'grid h-[19px] w-[19px] flex-shrink-0 place-items-center rounded-[7px] border-[1.5px] text-[11px]',
              it.done
                ? 'border-osa-green bg-osa-green text-white'
                : 'border-osa-border-strong text-transparent',
            )}
            aria-hidden
          >
            ✓
          </span>
          <span className={cn(it.done && 'text-osa-faint line-through')}>{it.label}</span>
          {it.who != null && <span className="ms-auto text-[11px] text-osa-faint">{it.who}</span>}
        </div>
      ))}
    </div>
  );
}
