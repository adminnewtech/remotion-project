'use client';

import { useState, useTransition } from 'react';
import type { UserRole } from '@elite/types';
import { Button, Input, Select, Modal, StatusPill, ProgressBar } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import type { StaffData, StaffMember } from '@/lib/admin-staff';
import { setStaffRole, assignRoleByPhone } from '@/app/[locale]/admin/staff/actions';

const ROLES: UserRole[] = ['employee', 'technician', 'driver', 'admin'];
const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

export function StaffTable({ data }: { data: StaffData }) {
  const { t, locale } = useT();
  const ar = locale === 'ar';
  const [members, setMembers] = useState<StaffMember[]>(data.members);
  const [invite, setInvite] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldStaff = members.filter((s) => s.role === 'driver' || s.role === 'technician');

  function changeRole(id: string, role: UserRole) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    startTransition(async () => {
      await setStaffRole(id, role);
    });
  }

  function submitInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteErr(null);
    const form = e.currentTarget;
    const phone = (form.elements.namedItem('phone') as HTMLInputElement)?.value ?? '';
    const role = (form.elements.namedItem('role') as HTMLSelectElement)?.value as UserRole;
    startTransition(async () => {
      const res = await assignRoleByPhone(phone, role);
      if (!res.ok && res.error === 'no_profile_for_phone') {
        setInviteErr(ar ? 'لا يوجد حساب مسجّل بهذا الرقم — يسجّل العميل أولاً ثم تعيّنه.' : 'No registered account for this phone — they must sign up first.');
        return;
      }
      setInvite(false);
    });
  }

  return (
    <>
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
        {/* ── Staff table ─────────────────────────────────────── */}
        <div className={`${CARD} overflow-hidden lg:col-span-2`}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[t('nav.staff'), ar ? 'مهام نشطة' : 'Active tasks', ar ? 'الدور' : 'Role'].map((h, i) => (
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
              {members.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-osa-surface-2">
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-osa-brand-dim text-[13px] font-semibold text-osa-brand">
                        {(s.full_name ?? '?').slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-osa-ink">{s.full_name}</p>
                        <p className="num text-[11.5px] text-osa-faint">{s.phone ?? s.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle">
                    <span className="num text-osa-muted">{s.activeTasks}</span>
                  </td>
                  <td className="border-b border-osa-border px-[18px] py-[11px] align-middle">
                    <select
                      className="rounded-osa-sm border border-osa-border bg-osa-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-osa-ink outline-none transition-colors focus:border-osa-brand-border"
                      value={s.role}
                      onChange={(e) => changeRole(s.id, e.target.value as UserRole)}
                      disabled={pending}
                      aria-label={ar ? 'الدور' : 'Role'}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Field utilization (real, from active tasks) ─────── */}
        <div className={`${CARD} p-[18px_20px]`}>
          <h2 className="mb-4 text-[14.5px] font-bold text-osa-ink">{t('admin.driverUtilization')}</h2>
          <div className="space-y-[13px]">
            {fieldStaff.map((s) => (
              <div key={s.id}>
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-osa-ink">{s.full_name}</span>
                  <span className="num text-osa-muted">{s.utilization}%</span>
                </div>
                <ProgressBar value={s.utilization} height={6} />
              </div>
            ))}
            {fieldStaff.length === 0 && (
              <p className="py-4 text-center text-[12px] text-osa-faint">{t('common.none')}</p>
            )}
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

      <Modal open={invite} onClose={() => setInvite(false)} title={t('admin.inviteStaff')}>
        <form className="space-y-4" onSubmit={submitInvite}>
          <p className="text-[12.5px] text-osa-muted">
            {ar
              ? 'أدخل رقم هاتف حساب مسجّل لتعيينه ضمن الطاقم.'
              : 'Enter the phone of a registered account to grant a staff role.'}
          </p>
          <Input name="phone" label={t('auth.phone')} type="tel" dir="ltr" placeholder="+965 XXXX XXXX" />
          <Select name="role" label={ar ? 'الدور' : 'Role'} defaultValue="employee">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
          {inviteErr && <p className="text-[12px] font-medium text-osa-rose">{inviteErr}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setInvite(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('admin.inviteStaff')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
