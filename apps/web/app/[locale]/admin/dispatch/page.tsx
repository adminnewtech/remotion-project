import { fetchDispatch } from '@/lib/admin-dispatch';
import { DispatchBoard } from '@/components/admin/dispatch/dispatch-board';

// Role-gated, live ops data — render per request.
export const dynamic = 'force-dynamic';

/** Dispatch board — live fulfillment tasks + field staff (native, no 3rd-party). */
export default async function DispatchPage() {
  const data = await fetchDispatch();
  return <DispatchBoard data={data} />;
}
