'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { SettingsData, StoreSettings, DeliveryZone } from '@/lib/admin-settings';
import { saveSettings, upsertZone, deleteZone } from '@/app/[locale]/admin/settings/actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';
const FIELD = 'w-full rounded-osa-sm border border-osa-border bg-osa-surface-2 px-3 py-2 text-[13px] text-osa-ink outline-none focus:border-osa-brand-border';
const LABEL = 'mb-1 block text-[12px] font-medium text-osa-muted';

type Tab = 'general' | 'delivery' | 'payments';

export function SettingsView({ data }: { data: SettingsData }) {
  const { locale } = useT();
  const ar = locale === 'ar';
  const [tab, setTab] = useState<Tab>('general');
  const [s, setS] = useState<StoreSettings>(data.settings);
  const [zones, setZones] = useState<DeliveryZone[]>(data.zones);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }
  function persist(patch: Partial<StoreSettings>) {
    setS((prev) => ({ ...prev, ...patch }));
  }
  function commit() {
    startTransition(async () => {
      const res = await saveSettings(s);
      flash(res.ok ? (ar ? 'تم الحفظ' : 'Saved') : (ar ? 'تعذّر الحفظ' : 'Save failed'));
    });
  }
  function saveZone(z: DeliveryZone) {
    startTransition(async () => {
      const res = await upsertZone(z);
      if (res.id && res.id !== z.id) setZones((p) => p.map((x) => (x.id === z.id ? { ...z, id: res.id! } : x)));
      flash(ar ? 'تم حفظ المنطقة' : 'Zone saved');
    });
  }
  function addZone() {
    const z: DeliveryZone = { id: `tmp-${Date.now()}`, governorate: ar ? 'منطقة جديدة' : 'New zone', area: null, fee: s.default_delivery_fee, eta_hours: 24, is_active: true, sort: zones.length + 1 };
    setZones((p) => [...p, z]);
  }
  function removeZone(id: string) {
    setZones((p) => p.filter((z) => z.id !== id));
    if (id.length === 36) startTransition(async () => { await deleteZone(id); });
  }

  const TABS: { key: Tab; ar: string; en: string }[] = [
    { key: 'general', ar: 'عام', en: 'General' },
    { key: 'delivery', ar: 'مناطق التوصيل', en: 'Delivery zones' },
    { key: 'payments', ar: 'الدفع والإشعارات', en: 'Payments & notifications' },
  ];

  return (
    <>
      <PageHeader
        title={ar ? 'الإعدادات' : 'Settings'}
        subtitle={ar ? 'إعدادات المتجر والتوصيل والدفع' : 'Store, delivery & payment configuration'}
        actions={
          <button type="button" onClick={commit} disabled={pending}
            className="rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97] disabled:opacity-50">
            {ar ? 'حفظ' : 'Save'}
          </button>
        }
      />

      {toast && <div className="mb-3 rounded-osa-sm bg-osa-green-dim px-3 py-2 text-[12.5px] font-semibold text-osa-green">{toast}</div>}

      <div className="mb-[14px] flex gap-1 rounded-full border border-osa-border bg-osa-surface-2 p-1 w-fit">
        {TABS.map((tb) => (
          <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
            className={'rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ' + (tab === tb.key ? 'bg-osa-brand text-white' : 'text-osa-muted hover:text-osa-ink')}>
            {ar ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className={`${CARD} p-5`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={LABEL}>{ar ? 'اسم المتجر (عربي)' : 'Store name (AR)'}</label><input className={FIELD} value={s.store_name_ar} onChange={(e) => persist({ store_name_ar: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'اسم المتجر (إنجليزي)' : 'Store name (EN)'}</label><input className={FIELD} value={s.store_name_en} onChange={(e) => persist({ store_name_en: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'هاتف الدعم' : 'Support phone'}</label><input dir="ltr" className={FIELD} value={s.support_phone ?? ''} onChange={(e) => persist({ support_phone: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'واتساب' : 'WhatsApp'}</label><input dir="ltr" className={FIELD} value={s.whatsapp_number ?? ''} onChange={(e) => persist({ whatsapp_number: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'بريد الدعم' : 'Support email'}</label><input dir="ltr" className={FIELD} value={s.support_email ?? ''} onChange={(e) => persist({ support_email: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'العملة' : 'Currency'}</label><input className={FIELD} value={s.currency} onChange={(e) => persist({ currency: e.target.value })} /></div>
            <div><label className={LABEL}>{ar ? 'حد التوصيل المجاني' : 'Free delivery threshold'}</label><input type="number" step="0.001" className={FIELD} value={s.free_delivery_threshold} onChange={(e) => persist({ free_delivery_threshold: Number(e.target.value) })} /></div>
            <div><label className={LABEL}>{ar ? 'رسوم التوصيل الافتراضية' : 'Default delivery fee'}</label><input type="number" step="0.001" className={FIELD} value={s.default_delivery_fee} onChange={(e) => persist({ default_delivery_fee: Number(e.target.value) })} /></div>
            <div><label className={LABEL}>{ar ? 'رسوم التركيب الافتراضية' : 'Default installation fee'}</label><input type="number" step="0.001" className={FIELD} value={s.default_installation_fee} onChange={(e) => persist({ default_installation_fee: Number(e.target.value) })} /></div>
          </div>
        </div>
      )}

      {tab === 'delivery' && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-osa-border p-3">
            <h2 className="text-[14.5px] font-bold text-osa-ink">{ar ? 'مناطق التوصيل والرسوم' : 'Delivery zones & fees'}</h2>
            <button type="button" onClick={addZone} className="rounded-full border border-osa-brand-border bg-osa-brand-dim px-3.5 py-1.5 text-[12.5px] font-semibold text-osa-brand">+ {ar ? 'منطقة' : 'Zone'}</button>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead><tr>{[ar ? 'المحافظة/المنطقة' : 'Governorate/Area', ar ? 'الرسوم' : 'Fee', ar ? 'مدة التوصيل (ساعة)' : 'ETA (h)', ar ? 'مفعّل' : 'Active', ''].map((h, i) => (<th key={i} className="border-b border-osa-border px-3 pb-2 pt-3 text-start text-[11.5px] font-medium text-osa-faint">{h}</th>))}</tr></thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td className="border-b border-osa-border px-3 py-2"><input className={FIELD} value={z.governorate} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, governorate: e.target.value } : x))} /></td>
                  <td className="border-b border-osa-border px-3 py-2"><input type="number" step="0.001" className={`${FIELD} w-24`} value={z.fee} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, fee: Number(e.target.value) } : x))} /></td>
                  <td className="border-b border-osa-border px-3 py-2"><input type="number" className={`${FIELD} w-20`} value={z.eta_hours} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, eta_hours: Number(e.target.value) } : x))} /></td>
                  <td className="border-b border-osa-border px-3 py-2"><input type="checkbox" checked={z.is_active} onChange={(e) => setZones((p) => p.map((x) => x.id === z.id ? { ...x, is_active: e.target.checked } : x))} /></td>
                  <td className="border-b border-osa-border px-3 py-2 text-end">
                    <button type="button" onClick={() => saveZone(zones.find((x) => x.id === z.id)!)} className="me-2 text-[12px] font-semibold text-osa-brand">{ar ? 'حفظ' : 'Save'}</button>
                    <button type="button" onClick={() => removeZone(z.id)} className="text-[12px] font-semibold text-osa-rose">{ar ? 'حذف' : 'Delete'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid gap-[14px] lg:grid-cols-2">
          <div className={`${CARD} p-5`}>
            <h2 className="mb-4 text-[14.5px] font-bold text-osa-ink">{ar ? 'طرق الدفع' : 'Payment methods'}</h2>
            {([['knet', 'KNET'], ['cod', ar ? 'الدفع عند الاستلام' : 'Cash on delivery'], ['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay']] as const).map(([k, label]) => (
              <label key={k} className="mb-2 flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-3 py-2.5">
                <span className="text-[13px] font-medium text-osa-ink">{label}</span>
                <input type="checkbox" checked={s.payments[k]} onChange={(e) => persist({ payments: { ...s.payments, [k]: e.target.checked } })} />
              </label>
            ))}
          </div>
          <div className={`${CARD} p-5`}>
            <h2 className="mb-4 text-[14.5px] font-bold text-osa-ink">{ar ? 'قنوات الإشعارات' : 'Notification channels'}</h2>
            {([['whatsapp', 'WhatsApp'], ['push', ar ? 'إشعارات التطبيق' : 'Push'], ['email', ar ? 'البريد' : 'Email'], ['sms', 'SMS']] as const).map(([k, label]) => (
              <label key={k} className="mb-2 flex items-center justify-between rounded-osa-sm bg-osa-surface-2 px-3 py-2.5">
                <span className="text-[13px] font-medium text-osa-ink">{label}</span>
                <input type="checkbox" checked={s.notifications[k]} onChange={(e) => persist({ notifications: { ...s.notifications, [k]: e.target.checked } })} />
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
