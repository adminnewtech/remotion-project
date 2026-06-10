import * as React from 'react';

import { cn } from './cn';

export type KpiTrend = 'up' | 'down' | 'flat';

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Secondary line under the value (e.g. comparison period). */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Delta vs. previous period, e.g. "+12%". Colored by `trend`. */
  delta?: React.ReactNode;
  trend?: KpiTrend;
  /** Show a small spinner / skeleton state while the metric loads. */
  loading?: boolean;
}

const trendClasses: Record<KpiTrend, string> = {
  up: 'text-success-700 bg-success-50',
  down: 'text-danger-700 bg-danger-50',
  flat: 'text-neutral-600 bg-neutral-100',
};

function TrendArrow({ trend }: { trend: KpiTrend }) {
  if (trend === 'flat') {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M5 12h14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={trend === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

/**
 * Dashboard KPI / stat tile: label, large value, optional trend delta and icon.
 * RTL-safe (logical layout). Use the `loading` flag for the metric-fetch state.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon,
  delta,
  trend = 'flat',
  loading = false,
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-surface p-4 shadow-sm', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-200" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
        {delta != null && !loading && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              trendClasses[trend],
            )}
          >
            <TrendArrow trend={trend} />
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Alias — some call sites refer to this as <StatCard>. */
export const StatCard = KpiCard;
export type StatCardProps = KpiCardProps;
