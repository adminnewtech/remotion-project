import { getServerClient } from '@/lib/supabase/server';
import { AppointmentsView, type Appt } from '@/components/admin/appointments/appointments-view';

export const dynamic = 'force-dynamic';

const SAMPLE: Appt[] = [
  { id: 'a1', kind: 'installation', customer_name: 'أحمد الكندري', phone: '+96550010001', order_number: 'NT-100245', scheduled_at: new Date(Date.now() + 86400000).toISOString(), status: 'booked', note: 'تركيب داش كام' },
  { id: 'a2', kind: 'pickup', customer_name: 'سارة المطيري', phone: null, order_number: 'NT-100244', scheduled_at: new Date(Date.now() + 7200000).toISOString(), status: 'booked', note: null },
  { id: 'a3', kind: 'inspection', customer_name: 'يوسف العنزي', phone: null, order_number: null, scheduled_at: new Date(Date.now() - 86400000).toISOString(), status: 'done', note: 'معاينة كاميرات محل' },
];

/** Appointments — installation / inspection / store pickup bookings. */
export default async function AppointmentsPage() {
  const client = await getServerClient();
  let rows: Appt[] = SAMPLE;
  let live = false;
  if (client) {
    try {
      const { data } = await client
        .from('appointments')
        .select('id, kind, customer_name, phone, order_number, scheduled_at, status, note')
        .order('scheduled_at', { ascending: true })
        .limit(80);
      if (data && data.length) { rows = data as Appt[]; live = true; }
      else if (data) { rows = []; live = true; }
    } catch { /* sample */ }
  }
  return <AppointmentsView rows={rows} live={live} />;
}
