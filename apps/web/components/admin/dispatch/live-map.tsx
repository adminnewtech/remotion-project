'use client';

/**
 * LiveOpsMap — admin live driver map (OSALPHA gold), web counterpart of the
 * mobile MapTracker. Renders Leaflet over OSM tiles (no API key), seeds with
 * the latest GPS ping per driver from `driver_locations`, then streams new
 * pings over Supabase Realtime so markers move live. Falls back to a quiet
 * empty state when env is absent or there are no recent pings.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { subscribeToTable } from '@elite/core';
import type { DriverLocation } from '@elite/types';
import { getBrowserClient } from '@/lib/supabase/client';
import { useT } from '@/lib/use-t';
import 'leaflet/dist/leaflet.css';

const KUWAIT_CENTER: [number, number] = [29.3759, 47.9774];
/** Only show pings from the last 2 hours — anything older is a stale shift. */
const FRESH_MS = 2 * 3600_000;

interface DriverPin {
  driverId: string;
  name: string;
  lat: number;
  lng: number;
  at: string;
}

export function LiveOpsMap({ driverNames }: { driverNames: Record<string, string> }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const holderRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const [pinCount, setPinCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const client = getBrowserClient();
    const markers = markersRef.current;

    async function boot() {
      if (!holderRef.current || mapRef.current) return;
      const L = (await import('leaflet')).default;
      if (cancelled || !holderRef.current) return;

      const map = L.map(holderRef.current, {
        center: KUWAIT_CENTER,
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      setReady(true);

      const pinIcon = (label: string) =>
        L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;gap:4px;transform:translate(-8px,-8px)">
            <span style="width:16px;height:16px;border-radius:9999px;background:#b8860b;border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></span>
            <span style="background:rgba(15,23,42,.85);color:#fff;font:600 11px system-ui;padding:2px 7px;border-radius:9999px;white-space:nowrap">${label}</span>
          </div>`,
          iconSize: [0, 0],
        });

      const upsertPin = (p: DriverPin) => {
        const existing = markersRef.current.get(p.driverId);
        if (existing) {
          existing.setLatLng([p.lat, p.lng]);
        } else {
          const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.name) }).addTo(map);
          markersRef.current.set(p.driverId, m);
          setPinCount(markersRef.current.size);
        }
      };

      if (client) {
        // Seed: latest ping per driver within the freshness window.
        const since = new Date(Date.now() - FRESH_MS).toISOString();
        const { data } = await client
          .from('driver_locations')
          .select('driver_id, lat, lng, recorded_at')
          .gte('recorded_at', since)
          .order('recorded_at', { ascending: false })
          .limit(300);
        const seen = new Set<string>();
        for (const r of (data ?? []) as { driver_id: string; lat: number; lng: number; recorded_at: string }[]) {
          if (seen.has(r.driver_id)) continue;
          seen.add(r.driver_id);
          upsertPin({
            driverId: r.driver_id,
            name: driverNames[r.driver_id] ?? (ar ? 'سائق' : 'Driver'),
            lat: r.lat,
            lng: r.lng,
            at: r.recorded_at,
          });
        }
        if (seen.size > 0) {
          const pts = Array.from(markersRef.current.values()).map((m) => m.getLatLng());
          map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 });
        }
      }
    }

    void boot();

    // Live stream: every new GPS ping moves (or adds) its driver's pin.
    const channel = client
      ? subscribeToTable<DriverLocation>(
          client,
          'driver_locations',
          (payload) => {
            const row = payload.new as DriverLocation | undefined;
            if (!row || !mapRef.current) return;
            const existing = markersRef.current.get(row.driver_id);
            if (existing) {
              existing.setLatLng([row.lat, row.lng]);
            } else {
              void import('leaflet').then((mod) => {
                if (!mapRef.current) return;
                const L = mod.default;
                const name = driverNames[row.driver_id] ?? (ar ? 'سائق' : 'Driver');
                const m = L.marker([row.lat, row.lng], {
                  icon: L.divIcon({
                    className: '',
                    html: `<div style="display:flex;align-items:center;gap:4px;transform:translate(-8px,-8px)">
                      <span style="width:16px;height:16px;border-radius:9999px;background:#b8860b;border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></span>
                      <span style="background:rgba(15,23,42,.85);color:#fff;font:600 11px system-ui;padding:2px 7px;border-radius:9999px;white-space:nowrap">${name}</span>
                    </div>`,
                    iconSize: [0, 0],
                  }),
                }).addTo(mapRef.current);
                markersRef.current.set(row.driver_id, m);
                setPinCount(markersRef.current.size);
              });
            }
          },
          { event: 'INSERT', channelName: 'rt:ops-map:driver_locations' },
        )
      : null;

    return () => {
      cancelled = true;
      if (channel && client) void client.removeChannel(channel);
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // driverNames is a server-provided plain object; identity-stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mb-[14px] overflow-hidden rounded-osa border border-osa-border bg-osa-surface shadow-osa">
      <div className="flex items-center justify-between border-b border-osa-border px-4 py-2.5">
        <h2 className="text-[14.5px] font-bold text-osa-ink">{ar ? 'الخريطة الحية' : 'Live map'}</h2>
        <span className="num rounded-full bg-osa-brand-dim px-2.5 py-0.5 text-[11.5px] font-semibold text-osa-brand">
          {pinCount} {ar ? 'سائق نشط' : 'active drivers'}
        </span>
      </div>
      <div className="relative">
        <div ref={holderRef} className="h-[320px] w-full" />
        {ready && pinCount === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] mx-auto w-fit rounded-full bg-osa-surface/90 px-4 py-1.5 text-[12px] font-medium text-osa-muted shadow-osa">
            {ar ? 'لا توجد إشارات GPS حديثة — تظهر مواقع السائقين هنا لحظياً أثناء التوصيل' : 'No recent GPS pings — driver positions stream here live during deliveries'}
          </div>
        )}
      </div>
    </section>
  );
}
