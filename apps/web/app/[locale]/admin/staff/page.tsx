'use client';

import { useState } from 'react';
import type { UserRole } from '@elite/types';
import { Table, Badge, Button, Input, Select, Modal, Avatar, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader, MeterRow } from '@/components/admin/ui';
import { staff } from '@/lib/admin-sample';
import { RoleGuard } from '@/components/role-guard';

const ROLES: UserRole[] = ['employee', 'technician', 'driver', 'admin'];

export default function StaffPage() {
  const { t, locale } = useT();
  const [invite, setInvite] = useState(false);

  const fieldStaff = staff.filter((s) => s.role === 'driver' || s.role === 'technician');

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={t('admin.staffManagement')}
        actions={<Button onClick={() => setInvite(true)}>{t('admin.inviteStaff')}</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface shadow-sm lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <th>{t('nav.staff')}</th>
                <th>{t('admin.assignZone')}</th>
                <th>{locale === 'ar' ? 'الدور' : 'Role'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={s.full_name ?? ''} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted">{s.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted">{s.zone ?? '—'}</td>
                  <td><Badge variant="info">{t(`roles.${s.role}`)}</Badge></td>
                  <td className="text-end">
                    <Button variant="ghost" size="sm">{t('admin.assignZone')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">{t('admin.driverUtilization')}</h2>
          <div className="space-y-3">
            {fieldStaff.map((s) => (
              <MeterRow key={s.id} label={s.full_name ?? ''} value={s.utilization ?? 0} max={100} suffix="%" />
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-success-50 p-3">
              <p className="text-xs text-muted">{t('admin.deliverySla')}</p>
              <p className="text-lg font-bold text-success-700">96%</p>
            </div>
            <div className="rounded-xl bg-info-50 p-3">
              <p className="text-xs text-muted">{t('admin.installationSla')}</p>
              <p className="text-lg font-bold text-info-700">92%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Audit log preview */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">{t('admin.auditLog')}</h2>
        <ul className="space-y-2 text-sm">
          {[
            { actor: 'Dev Admin', action: 'role_change', entity: 'profiles/Nawaf I.', when: '10:24' },
            { actor: 'Layla O.', action: 'refund', entity: 'orders/NT-100210', when: '09:58' },
            { actor: 'Dev Admin', action: 'price_edit', entity: 'products/Samsung 65"', when: '09:30' },
          ].map((e, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
              <span><span className="font-medium">{e.actor}</span> · <span className="font-mono text-xs text-muted">{e.action}</span> · {e.entity}</span>
              <StatusBadge status="completed" labelOverride={e.when} />
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
