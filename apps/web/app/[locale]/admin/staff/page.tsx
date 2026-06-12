'use client';

import { useState } from 'react';
import type { UserRole } from '@elite/types';
import { Button, Input, Select, Modal, StatusPill, ProgressBar } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import { staff } from '@/lib/admin-sample';
import { RoleGuard } from '@/components/role-guard';

const ROLES: UserRole[] = ['employee', 'technician', 'driver', 'admin'];

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

export default function StaffPage() {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [invite, setInvite] = useState(false);

  const fieldStaff = staff.filter((s) => s.role === 'driver' || s.role === 'technician');

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={t('admin.staffManagement')}
        actions={
          <button
            type="button"
            onClick={() => setInvite(true)}
            className="osa-btn-primary flex items-center gap-2 rounded-full bg-osa-brand px-5 py-[9px] text-[13.5px] font-semibold text-white shadow-[0_4px_12px_rgba(184,134,11,.25)] transition-transform active:scale-[.97]"
          >
            {t('admin.inviteStaff')}
          </button>
        }
      />

      <div className="grid gap-[14px] lg:grid-cols-3">
        {/* ── Staff table (gold DataTable look) ───────────────── */}
        <div className={`${CARD} overflow-hidden lg:col-span-2`}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[t('nav.staff'), t('admin.assignZone'), ar ? 'الدور' : 'Role', ''].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-osa-border px-[18px] pb-[11px] pt-[16px] text-start text-[11.5px] font-medium text-osa-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-osa-surface-2">
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[13px] font-semibold text-osa-brand">
                        {(s.full_name ?? '?').slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-osa-ink">{s.full_name}</p>
                        <p className="num text-[11.5px] text-osa-faint">{s.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle text-osa-muted">
                    {s.zone ?? '—'}
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle">
                    <StatusPill tone="brand">{t(`roles.${s.role}`)}</StatusPill>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle text-end">
                    <button
                      type="button"
                      className="rounded-osa-sm px-2.5 py-1 text-[12px] font-semibold text-osa-brand transition-colors hover:bg-osa-brand-dim"
                    >
                      {t('admin.assignZone')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Driver utilization ──────────────────────────────── */}
        <div className={`${CARD} p-[18px_20px]`}>
          <h2 className="mb-4 text-[14.5px] font-bold text-osa-ink">{t('admin.driverUtilization')}</h2>
          <div className="space-y-[13px]">
            {fieldStaff.map((s) => (
              <div key={s.id}>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-osa-ink">{s.full_name}</span>
                  <span className="num text-osa-muted">{s.utilization ?? 0}%</span>
                </div>
                <ProgressBar value={s.utilization ?? 0} height={6} />
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-osa-sm bg-osa-green-dim p-3">
              <p className="text-[11.5px] text-osa-muted">{t('admin.deliverySla')}</p>
              <p className="num mt-0.5 text-[18px] font-bold text-osa-green">96%</p>
            </div>
            <div className="rounded-osa-sm bg-osa-blue-dim p-3">
              <p className="text-[11.5px] text-osa-muted">{t('admin.installationSla')}</p>
              <p className="num mt-0.5 text-[18px] font-bold text-osa-blue">92%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Audit log preview ─────────────────────────────────── */}
      <div className={`${CARD} mt-[14px] p-[18px_20px]`}>
        <h2 className="mb-3 text-[14.5px] font-bold text-osa-ink">{t('admin.auditLog')}</h2>
        <ul className="space-y-2 text-[13px]">
          {[
            { actor: 'Dev Admin', action: 'role_change', entity: 'profiles/Nawaf I.', when: '10:24' },
            { actor: 'Layla O.', action: 'refund', entity: 'orders/NT-100210', when: '09:58' },
            { actor: 'Dev Admin', action: 'price_edit', entity: 'products/Samsung 65"', when: '09:30' },
          ].map((e, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-osa-sm bg-osa-surface-2 px-3 py-2"
            >
              <span className="text-osa-ink">
                <span className="font-semibold">{e.actor}</span> ·{' '}
                <span className="num text-[11.5px] text-osa-muted">{e.action}</span> ·{' '}
                <span className="text-osa-muted">{e.entity}</span>
              </span>
              <StatusPill tone="neutral">
                <span className="num">{e.when}</span>
              </StatusPill>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={invite} onClose={() => setInvite(false)} title={t('admin.inviteStaff')}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setInvite(false); }}>
          <Input label={t('auth.fullName')} />
          <Input label={t('auth.phone')} type="tel" dir="ltr" placeholder="+965 XXXX XXXX" />
          <Select label={t('common.all')} defaultValue="employee">
            {ROLES.map((r) => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setInvite(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('admin.inviteStaff')}</Button>
          </div>
        </form>
      </Modal>
    </RoleGuard>
  );
}
