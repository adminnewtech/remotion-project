'use client';

import type { ReactNode } from 'react';

/** Admin page header with title + optional actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** KPI metric card. */
export function KpiCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta?: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {delta != null && (
        <p className={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-success' : 'text-danger'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
        </p>
      )}
    </div>
  );
}

/** Minimal CSS bar chart (no chart lib needed for v1 UI). */
export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-primary to-accent transition-all"
            style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }}
            title={String(d.value)}
          />
          <span className="text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal labeled progress bar (utilization, demand share). */
export function MeterRow({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">{value}{suffix ?? ''}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
