'use client';

import { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '@elite/types';
import { realtime } from '@elite/core';
import { useT } from '@/lib/use-t';
import { useSupabase } from '@/components/providers';

/** Canonical happy-path order lifecycle for the timeline. */
const FLOW: OrderStatus[] = [
  'paid',
  'processing',
  'out_for_delivery',
  'delivered',
  'installing',
  'completed',
];

/**
 * Live order status timeline. Renders the lifecycle steps and highlights
 * progress, subscribing to realtime status changes when a Supabase client is
 * present (falls back to the static prop otherwise).
 */
export function OrderTimeline({ order }: { order: Order }) {
  const { t } = useT();
  const supabase = useSupabase();
  const [status, setStatus] = useState<OrderStatus>(order.status);

  useEffect(() => {
    if (!supabase) return;
    const channel = realtime.subscribeToOrderStatus(supabase, order.id, (next) => setStatus(next));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, order.id]);

  // Cancelled / refunded short-circuit the happy path.
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <div className="rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-medium text-danger-700">
        {t(`orderStatus.${status}`)}
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(status);

  return (
    <ol className="relative space-y-5 ps-6">
      <span className="absolute bottom-2 start-[7px] top-2 w-px bg-border" aria-hidden />
      {FLOW.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="relative">
            <span
              className={`absolute -start-6 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-surface ${
                done ? 'bg-success' : active ? 'bg-primary animate-pulse' : 'bg-neutral-300'
              }`}
              aria-hidden
            />
            <p className={`text-sm font-semibold ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted'}`}>
              {t(`orderStatus.${step}`)}
            </p>
            {active && <p className="text-xs text-muted">{t('common.today')}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Live driver map placeholder. A real build mounts Google Maps / Mapbox here
 * and streams `realtime.subscribeToDriverLocation`. This renders a branded
 * placeholder with the latest known coordinates / ETA.
 */
export function DriverMap({
  taskId,
  initialEtaMinutes = 18,
}: {
  taskId: string | null;
  initialEtaMinutes?: number;
}) {
  const { t } = useT();
  const supabase = useSupabase();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!supabase || !taskId) return;
    const channel = realtime.subscribeToDriverLocation(supabase, taskId, (loc) =>
      setCoords({ lat: loc.lat, lng: loc.lng }),
    );
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, taskId]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div
        className="flex h-56 items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 30%, rgba(67,56,202,0.10), transparent 40%), radial-gradient(circle at 70% 60%, rgba(6,182,212,0.12), transparent 45%)',
        }}
      >
        <div className="text-center">
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M3 13l2-5a2 2 0 0 1 1.9-1.4h6.2A2 2 0 0 1 17 8l2 5v5h-2M3 18H1v-5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-primary-700">{t('delivery.driverOnTheWay')}</p>
          <p className="text-xs text-muted">{t('delivery.arrivingIn', { minutes: initialEtaMinutes })}</p>
          {coords && (
            <p className="mt-1 font-mono text-[11px] text-muted">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-4 py-2 text-xs text-muted">
        <span>{t('delivery.tracking')}</span>
        <span className="font-mono">{taskId ? `#${taskId.slice(0, 8)}` : '—'}</span>
      </div>
    </div>
  );
}
