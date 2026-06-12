'use client';

import { useState, useTransition } from 'react';
import { Button, Badge } from '@elite/ui/web';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { PickupOrder } from './page';
import { verifyPickup, markReadyForPickup } from './actions';

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge variant="info">مدفوع</Badge>;
    case 'ready_for_pickup':
      return <Badge variant="accent">جاهز للاستلام</Badge>;
    case 'completed':
      return <Badge variant="success">مكتمل</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

function PickupOrderCard({ order }: { order: PickupOrder }) {
  const [codeInput, setCodeInput] = useState('');
  const [showVerify, setShowVerify] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [verifying, startVerify] = useTransition();
  const [marking, startMark] = useTransition();

  function handleVerify() {
    setMessage('');
    if (!codeInput.trim()) {
      setMessage('أدخل كود الاستلام');
      setMessageKind('error');
      return;
    }
    startVerify(async () => {
      const res = await verifyPickup(order.id, codeInput.trim());
      if (res.ok) {
        setMessage('تم التحقق من الاستلام بنجاح. الطلب مكتمل.');
        setMessageKind('success');
        setShowVerify(false);
        setCodeInput('');
      } else {
        setMessage(res.error ?? 'خطأ في التحقق');
        setMessageKind('error');
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-base">{order.orderNumber}</p>
          <p className="text-sm text-muted">{order.customerPhone ?? 'لا يوجد رقم'}</p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(order.status)}
          <span className="text-sm font-semibold">{order.totalAmount.toFixed(3)} KWD</span>
        </div>
      </div>

      {/* Items summary */}
      <div className="flex flex-wrap gap-1">
        {order.items.map((item, i) => (
          <Badge key={i} variant="neutral">
            {item.productName} ×{item.qty}
          </Badge>
        ))}
        {order.items.length === 0 && (
          <span className="text-xs text-muted">لا بنود</span>
        )}
      </div>

      {/* Pickup code */}
      {order.pickupCode && (
        <div className="flex items-center gap-2 rounded-md bg-neutral-50 border border-border px-3 py-2">
          <span className="text-xs text-muted">كود الاستلام:</span>
          <code className="font-mono font-bold text-sm">{order.pickupCode}</code>
        </div>
      )}

      {message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            messageKind === 'success'
              ? 'bg-success-50 text-success-700'
              : 'bg-danger-50 text-danger-700'
          }`}
        >
          {message}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {order.status === 'paid' && (
          <Button
            size="sm"
            variant="secondary"
            loading={marking}
            onClick={() =>
              startMark(async () => {
                const res = await markReadyForPickup(order.id);
                if (!res.ok) {
                  setMessage(res.error ?? 'خطأ');
                  setMessageKind('error');
                }
              })
            }
          >
            تحضير للاستلام
          </Button>
        )}
        {order.status !== 'completed' && (
          <Button
            size="sm"
            onClick={() => {
              setShowVerify((v) => !v);
              setMessage('');
            }}
          >
            تحقق من الاستلام
          </Button>
        )}
      </div>

      {showVerify && order.status !== 'completed' && (
        <div className="flex gap-2 items-center pt-1">
          <input
            type="text"
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm font-mono"
            placeholder="أدخل كود الاستلام من العميل"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
          />
          <Button size="sm" loading={verifying} onClick={handleVerify}>
            تأكيد
          </Button>
        </div>
      )}
    </div>
  );
}

export function PickupClient({
  orders,
  live,
}: {
  orders: PickupOrder[];
  live: boolean;
}) {
  const paidCount = orders.filter((o) => o.status === 'paid').length;
  const readyCount = orders.filter((o) => o.status === 'ready_for_pickup').length;

  return (
    <RoleGuard allow={['admin', 'ops']}>
      <PageHeader
        title="الاستلام من المحل — Pickup Orders"
        subtitle="طلبات الاستلام الشخصي — مدفوعة وجاهزة"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="مدفوعة (بانتظار التحضير)" value={String(paidCount)} />
        <KpiCard label="جاهزة للاستلام" value={String(readyCount)} />
        <KpiCard label="حالة البيانات" value={live ? 'مباشر' : 'نماذج'} />
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-16 text-center text-muted">
          لا توجد طلبات استلام بانتظار المعالجة.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <PickupOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </RoleGuard>
  );
}
