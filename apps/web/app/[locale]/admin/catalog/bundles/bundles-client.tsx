'use client';

import { useState, useTransition } from 'react';
import { Button, Badge, Modal, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@elite/ui/web';
import { PageHeader, KpiCard } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { BundlesData } from '@/lib/admin-commerce';
import { createBundle, setBundleActive, type BundleInput } from './actions';

interface ComponentDraft {
  component: 'variant' | 'service';
  variantId: string;
  service: 'installation' | 'inspection' | '';
  qty: number;
  pricePart: number;
}

const emptyDraft: ComponentDraft = {
  component: 'variant',
  variantId: '',
  service: '',
  qty: 1,
  pricePart: 0,
};

export function BundlesClient({ data }: { data: BundlesData }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [components, setComponents] = useState<ComponentDraft[]>([{ ...emptyDraft }]);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const activeBundles = data.bundles.filter((b) => b.isActive).length;

  function addComponent() {
    setComponents((prev) => [...prev, { ...emptyDraft }]);
  }

  function removeComponent(i: number) {
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateComponent(i: number, patch: Partial<ComponentDraft>) {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function validateAndSave() {
    setError('');
    const price = parseFloat(bundlePrice);
    if (!productId) { setError('اختر المنتج'); return; }
    if (isNaN(price) || price <= 0) { setError('أدخل سعر الباقة'); return; }
    if (components.length === 0) { setError('أضف مكوناً واحداً على الأقل'); return; }

    const sumParts = components.reduce((s, c) => s + c.pricePart, 0);
    if (Math.abs(sumParts - price) > 0.001) {
      setError(`مجموع أجزاء السعر (${sumParts.toFixed(3)}) يجب أن يساوي سعر الباقة (${price.toFixed(3)})`);
      return;
    }

    const input: BundleInput = {
      productId,
      bundlePrice: price,
      components: components.map((c) => ({
        component: c.component,
        variantId: c.component === 'variant' ? c.variantId : undefined,
        service: c.component === 'service' ? (c.service as 'installation' | 'inspection') : undefined,
        qty: c.qty,
        pricePart: c.pricePart,
      })),
    };

    startTransition(async () => {
      const res = await createBundle(input);
      if (res.ok) {
        setOpen(false);
        setProductId('');
        setBundlePrice('');
        setComponents([{ ...emptyDraft }]);
      } else {
        setError(res.error ?? 'خطأ غير معروف');
      }
    });
  }

  return (
    <RoleGuard allow={['admin', 'ops']}>
      <PageHeader
        title="الباقات — Product Bundles"
        subtitle="باقات المنتجات مع الخدمات (مثل مكيف + تركيب)"
        actions={
          <Button onClick={() => setOpen(true)}>+ إنشاء باقة جديدة</Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 mb-6">
        <KpiCard label="إجمالي الباقات" value={String(data.bundles.length)} />
        <KpiCard label="الباقات النشطة" value={String(activeBundles)} />
        <KpiCard label="حالة البيانات" value={data.live ? 'مباشر' : 'نماذج'} />
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>سعر الباقة (KWD)</TableHead>
              <TableHead>المكونات</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.bundles.map((bundle) => (
              <TableRow key={bundle.id}>
                <TableCell className="font-medium">{bundle.productName}</TableCell>
                <TableCell>
                  {bundle.bundlePrice != null ? bundle.bundlePrice.toFixed(3) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {bundle.components.map((c) => (
                      <Badge key={c.id} variant={c.component === 'service' ? 'accent' : 'info'}>
                        {c.label} ×{c.qty}
                      </Badge>
                    ))}
                    {bundle.components.length === 0 && <span className="text-muted text-xs">لا مكونات</span>}
                  </div>
                </TableCell>
                <TableCell>
                  {bundle.isActive
                    ? <Badge variant="success">نشط</Badge>
                    : <Badge variant="neutral">متوقف</Badge>}
                </TableCell>
                <TableCell>
                  <ToggleButton
                    id={bundle.id}
                    isActive={bundle.isActive}
                  />
                </TableCell>
              </TableRow>
            ))}
            {data.bundles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted">
                  لا توجد باقات بعد. أنشئ باقتك الأولى.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إنشاء باقة جديدة"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={validateAndSave} loading={isPending}>حفظ الباقة</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">المنتج</label>
            <select
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">اختر منتجاً…</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">سعر الباقة (KWD)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              placeholder="مثال: 250.000"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">المكونات</label>
              <Button size="sm" variant="outline" onClick={addComponent}>+ إضافة مكون</Button>
            </div>
            <div className="space-y-3">
              {components.map((comp, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">مكون {i + 1}</span>
                    {components.length > 1 && (
                      <button
                        onClick={() => removeComponent(i)}
                        className="text-xs text-danger hover:underline"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted">نوع المكون</label>
                      <select
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                        value={comp.component}
                        onChange={(e) => updateComponent(i, { component: e.target.value as 'variant' | 'service' })}
                      >
                        <option value="variant">منتج / متغير</option>
                        <option value="service">خدمة</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                        value={comp.qty}
                        onChange={(e) => updateComponent(i, { qty: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>
                  {comp.component === 'variant' ? (
                    <div>
                      <label className="mb-1 block text-xs text-muted">معرّف المتغير (UUID)</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm font-mono"
                        value={comp.variantId}
                        onChange={(e) => updateComponent(i, { variantId: e.target.value })}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-xs text-muted">نوع الخدمة</label>
                      <select
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                        value={comp.service}
                        onChange={(e) => updateComponent(i, { service: e.target.value as 'installation' | 'inspection' })}
                      >
                        <option value="">اختر…</option>
                        <option value="installation">تركيب</option>
                        <option value="inspection">فحص</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-muted">جزء السعر (KWD)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                      value={comp.pricePart}
                      onChange={(e) => updateComponent(i, { pricePart: parseFloat(e.target.value) || 0 })}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              مجموع أجزاء السعر:{' '}
              <strong>{components.reduce((s, c) => s + c.pricePart, 0).toFixed(3)} KWD</strong>
              {' '}— يجب أن يساوي سعر الباقة.
            </p>
          </div>
        </div>
      </Modal>
    </RoleGuard>
  );
}

function ToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={isActive ? 'outline' : 'secondary'}
      loading={pending}
      onClick={() => startTransition(() => setBundleActive(id, !isActive))}
    >
      {isActive ? 'إيقاف' : 'تفعيل'}
    </Button>
  );
}
