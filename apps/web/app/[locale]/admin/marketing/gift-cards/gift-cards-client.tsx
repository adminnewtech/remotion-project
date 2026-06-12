'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  Badge,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@elite/ui/web';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { GiftCardsData } from '@/lib/admin-commerce';
import { issueGiftCard } from './actions';

function statusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">نشطة</Badge>;
    case 'depleted':
      return <Badge variant="neutral">مستنفدة</Badge>;
    case 'expired':
      return <Badge variant="warning">منتهية</Badge>;
    case 'voided':
      return <Badge variant="danger">ملغاة</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export function GiftCardsClient({ data }: { data: GiftCardsData }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [expiryDays, setExpiryDays] = useState('365');
  const [issuedCode, setIssuedCode] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  // Total issued this month (client-side calculation)
  const now = new Date();
  const issuedThisMonth = data.cards.filter((c) => {
    const d = new Date(c.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  function handleIssue() {
    setError('');
    setIssuedCode('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('أدخل مبلغاً صحيحاً');
      return;
    }
    startTransition(async () => {
      const res = await issueGiftCard({
        amount: amt,
        recipientPhone: phone || undefined,
        expiryDays: parseInt(expiryDays) || 365,
      });
      if (res.ok) {
        setIssuedCode(res.code);
        setAmount('');
        setPhone('');
        setExpiryDays('365');
      } else {
        setError(res.error ?? 'خطأ غير معروف');
      }
    });
  }

  return (
    <RoleGuard allow={['admin', 'ops']}>
      <PageHeader
        title="بطاقات الهدايا — Gift Cards"
        subtitle="إصدار وإدارة بطاقات الهدايا بالدينار الكويتي"
        actions={
          <Button onClick={() => { setOpen(true); setIssuedCode(''); setError(''); }}>
            + إصدار بطاقة هدية
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label="البطاقات النشطة"
          value={String(data.totalActive)}
        />
        <KpiCard
          label="إجمالي الالتزام (KWD)"
          value={data.totalLiability.toFixed(3)}
        />
        <KpiCard
          label="صُدرت هذا الشهر"
          value={String(issuedThisMonth)}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>القيمة الأولية</TableHead>
              <TableHead>الرصيد الحالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>رقم المستلم</TableHead>
              <TableHead>تاريخ الانتهاء</TableHead>
              <TableHead>تاريخ الإصدار</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono">
                    {card.code}
                  </code>
                </TableCell>
                <TableCell>{card.initialValue.toFixed(3)}</TableCell>
                <TableCell className="font-semibold">{card.balance.toFixed(3)}</TableCell>
                <TableCell>{statusBadge(card.status)}</TableCell>
                <TableCell>{card.recipientPhone ?? '—'}</TableCell>
                <TableCell>{card.expiresAt ?? '—'}</TableCell>
                <TableCell className="text-muted text-xs">
                  {new Date(card.createdAt).toLocaleDateString('ar-KW')}
                </TableCell>
              </TableRow>
            ))}
            {data.cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted">
                  لا توجد بطاقات هدايا بعد.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إصدار بطاقة هدية جديدة"
        size="sm"
        footer={
          issuedCode ? (
            <Button onClick={() => setOpen(false)}>إغلاق</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button onClick={handleIssue} loading={isPending}>إصدار</Button>
            </>
          )
        }
      >
        {issuedCode ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-success-700 font-medium">تم إصدار البطاقة بنجاح!</p>
            <div className="rounded-lg border-2 border-dashed border-primary p-4">
              <p className="text-xs text-muted mb-1">كود البطاقة</p>
              <p className="text-xl font-bold font-mono tracking-wider">{issuedCode}</p>
            </div>
            <p className="text-xs text-muted">احتفظ بهذا الكود وأرسله للعميل.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">المبلغ (KWD)</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 50.000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                رقم هاتف المستلم{' '}
                <span className="font-normal text-muted">(اختياري)</span>
              </label>
              <input
                type="tel"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="مثال: 96512345678"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">مدة الصلاحية (أيام)</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </RoleGuard>
  );
}
