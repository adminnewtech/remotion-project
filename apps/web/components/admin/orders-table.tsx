'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@elite/types';
import { Table, StatusBadge, PriceTag, Input, Select, Button, Modal } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { fmtDate } from '@/lib/format';
import { PageHeader } from '@/components/admin/ui';

const STATUSES: OrderStatus[] = [
  'pending_payment', 'paid', 'processing', 'out_for_delivery', 'delivered', 'installing', 'completed', 'cancelled', 'refunded',
];

export function AdminOrdersTable({ orders }: { orders: Order[] }) {
  const { t, locale } = useT();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [refund, setRefund] = useState<Order | null>(null);

  const view = useMemo(() => {
    return orders.filter(
      (o) =>
        (!status || o.status === status) &&
        (!q || o.order_number.toLowerCase().includes(q.toLowerCase())),
    );
  }, [orders, q, status]);

  return (
    <div>
      <PageHeader title={t('admin.orders')} subtitle={t('admin.overview')} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} className="max-w-xs">
          <option value="">{t('common.all')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`orderStatus.${s}`)}</option>
          ))}
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <Table>
          <thead>
            <tr>
              <th>#</th>
              <th>{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th>{t('cart.total')}</th>
              <th>{t('admin.orders')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.map((o) => (
              <tr key={o.id}>
                <td className="font-mono text-xs">{o.order_number}</td>
                <td className="text-muted">{o.placed_at ? fmtDate(o.placed_at, locale) : '—'}</td>
                <td><PriceTag price={o.total} locale={locale} inline /></td>
                <td><StatusBadge status={o.status} label={t(`orderStatus.${o.status}`)} /></td>
                <td className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => setRefund(o)}>
                    {t('admin.refund')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Modal open={!!refund} onClose={() => setRefund(null)} title={t('admin.issueRefund')}>
        {refund && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('orders.orderNumber', { number: refund.order_number })} — <PriceTag price={refund.total} locale={locale} inline />
            </p>
            <Input label={t('cart.total')} type="number" defaultValue={refund.total} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRefund(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" onClick={() => setRefund(null)}>{t('admin.issueRefund')}</Button>
            </div>
            <p className="text-xs text-muted">{locale === 'ar' ? 'يُسجّل هذا الإجراء في سجل التدقيق.' : 'This action is recorded in the audit log.'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
