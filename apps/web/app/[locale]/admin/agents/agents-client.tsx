'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/use-t';
import { PageHeader } from '@/components/admin/ui';
import { RoleGuard } from '@/components/role-guard';
import type { AgentsData, AgentStats } from '@/lib/admin-agents-config';
import { AGENT_CONFIGS } from '@/lib/admin-agents-config';
import { toggleAgentKillSwitch } from './actions';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa';

const STATUS_COLORS: Record<string, string> = {
  executed: 'bg-green-100 text-green-700',
  proposed: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

const RISK_COLORS: Record<string, string> = {
  sensitive: 'bg-red-100 text-red-700',
  write: 'bg-amber-100 text-amber-700',
  read: 'bg-green-100 text-green-700',
};

const AGENT_LABELS: Record<string, string> = {
  sales: 'مبيعات',
  triage: 'تصنيف',
  ops: 'عمليات',
  insight: 'تحليلات',
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-KW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface KillSwitchToggleProps {
  agentKey: string;
  enabled: boolean;
  onToggle: (key: string, enabled: boolean) => void;
  loading: boolean;
}

function KillSwitchToggle({ agentKey, enabled, onToggle, loading }: KillSwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={loading}
      onClick={() => onToggle(agentKey, !enabled)}
      className={
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ' +
        (enabled ? 'bg-osa-brand' : 'bg-osa-surface-3')
      }
    >
      <span
        className={
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ' +
          (enabled ? 'translate-x-5' : 'translate-x-0')
        }
      />
    </button>
  );
}

interface AgentCardProps {
  agentKey: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  functionName: string;
  enabled: boolean;
  stats: AgentStats | undefined;
  onToggle: (key: string, enabled: boolean) => void;
  toggling: boolean;
  locale: string;
}

function AgentCard({ agentKey, nameAr, nameEn, descAr, descEn, functionName, enabled, stats, onToggle, toggling, locale }: AgentCardProps) {
  const ar = locale === 'ar';
  const totalActions = stats?.total ?? 0;
  const pendingCount = stats?.pending ?? 0;

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={
                'inline-block h-2 w-2 flex-shrink-0 rounded-full ' +
                (enabled ? 'bg-osa-green' : 'bg-osa-faint')
              }
            />
            <h3 className="text-[14px] font-bold text-osa-ink">{ar ? nameAr : nameEn}</h3>
          </div>
          <p className="mt-0.5 text-[12px] text-osa-faint font-mono">{functionName}</p>
        </div>
        <KillSwitchToggle
          agentKey={agentKey}
          enabled={enabled}
          onToggle={onToggle}
          loading={toggling}
        />
      </div>

      <p className="mb-4 text-[12.5px] text-osa-muted leading-snug">
        {ar ? descAr : descEn}
      </p>

      <div className="grid grid-cols-3 gap-2 border-t border-osa-border pt-3">
        <div className="text-center">
          <div className="num text-[18px] font-bold text-osa-ink">{totalActions}</div>
          <div className="text-[10.5px] text-osa-faint">{ar ? 'إجمالي' : 'Total'}</div>
        </div>
        <div className="text-center">
          <div className={`num text-[18px] font-bold ${pendingCount > 0 ? 'text-osa-amber' : 'text-osa-ink'}`}>
            {pendingCount}
          </div>
          <div className="text-[10.5px] text-osa-faint">{ar ? 'معلّق' : 'Pending'}</div>
        </div>
        <div className="text-center">
          <div className="num text-[18px] font-bold text-green-600">{stats?.approved ?? 0}</div>
          <div className="text-[10.5px] text-osa-faint">{ar ? 'موافق' : 'Approved'}</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span
          className={
            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' +
            (enabled
              ? 'bg-green-100 text-green-700'
              : 'bg-osa-surface-2 text-osa-faint')
          }
        >
          {ar
            ? enabled ? 'مُفعَّل' : 'مُعطَّل'
            : enabled ? 'Active' : 'Disabled'}
        </span>
        {toggling && (
          <span className="text-[11px] text-osa-faint animate-pulse">
            {ar ? 'جارٍ التحديث…' : 'Updating…'}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentsClient({ data }: { data: AgentsData }) {
  const { locale } = useT();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [localKillSwitches, setLocalKillSwitches] = useState<Record<string, boolean>>(data.killSwitches);

  const ar = locale === 'ar';
  const pendingTotal = data.stats.reduce((s, r) => s + r.pending, 0);
  const evalPct = data.evalSummary.total > 0
    ? Math.round((data.evalSummary.passed / data.evalSummary.total) * 100)
    : null;

  function handleToggle(key: string, enabled: boolean) {
    setTogglingKey(key);
    setLocalKillSwitches((prev) => ({ ...prev, [key]: enabled }));
    startTransition(async () => {
      try {
        await toggleAgentKillSwitch(key, enabled);
        router.refresh();
      } catch {
        // revert optimistic update on error
        setLocalKillSwitches((prev) => ({ ...prev, [key]: !enabled }));
      } finally {
        setTogglingKey(null);
      }
    });
  }

  return (
    <RoleGuard allow={['admin']}>
      <PageHeader
        title={ar ? 'مركز الوكلاء الذكيين' : 'AI Agents Hub'}
        actions={
          pendingTotal > 0 ? (
            <a
              href={`/${locale}/admin/approvals`}
              className="flex items-center gap-1.5 rounded-full bg-osa-amber px-3 py-1.5 text-[12.5px] font-bold text-white shadow-sm"
            >
              ⚠ {pendingTotal} {ar ? 'بانتظار الموافقة' : 'awaiting approval'}
            </a>
          ) : undefined
        }
      />

      {/* Summary strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: ar ? 'وكلاء نشطون' : 'Active Agents',
            value: AGENT_CONFIGS.filter((a) => (localKillSwitches[a.key] ?? true) !== false).length,
            of: AGENT_CONFIGS.length,
            color: 'text-osa-brand',
          },
          {
            label: ar ? 'إجراءات معلّقة' : 'Pending Actions',
            value: pendingTotal,
            color: pendingTotal > 0 ? 'text-osa-amber' : 'text-osa-ink',
          },
          {
            label: ar ? 'إجمالي الإجراءات' : 'Total Actions',
            value: data.stats.reduce((s, r) => s + r.total, 0),
            color: 'text-osa-ink',
          },
          {
            label: ar ? 'نجاح الاختبارات' : 'Eval Pass Rate',
            value: evalPct !== null ? `${evalPct}%` : '—',
            color: evalPct !== null && evalPct >= 75 ? 'text-green-600' : 'text-osa-muted',
          },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4 text-center`}>
            <div className={`num text-[22px] font-bold ${s.color}`}>
              {typeof s.value === 'number' && s.of !== undefined
                ? `${s.value}/${s.of}`
                : s.value}
            </div>
            <div className="mt-0.5 text-[11.5px] text-osa-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
          {ar ? 'الوكلاء ومفاتيح التحكم' : 'Agents & Kill Switches'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_CONFIGS.map((cfg) => {
            const enabled = localKillSwitches[cfg.key] !== false;
            const stats = data.stats.find((s) => s.key === cfg.key);
            return (
              <AgentCard
                key={cfg.key}
                agentKey={cfg.key}
                nameAr={cfg.nameAr}
                nameEn={cfg.nameEn}
                descAr={cfg.descAr}
                descEn={cfg.descEn}
                functionName={cfg.functionName}
                enabled={enabled}
                stats={stats}
                onToggle={handleToggle}
                toggling={togglingKey === cfg.key}
                locale={locale}
              />
            );
          })}
        </div>
      </section>

      {/* Eval summary */}
      <section className="mb-8">
        <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
          {ar ? 'نتائج الاختبارات التلقائية' : 'Eval Results'}
        </h2>
        <div className={`${CARD} p-5`}>
          {data.evalSummary.total === 0 ? (
            <p className="text-center text-[13px] text-osa-faint">
              {ar ? 'لا توجد نتائج — شغّل eval-agents.ts للاختبار' : 'No results yet — run scripts/eval-agents.ts to test'}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-8">
              <div className="text-center">
                <div className="num text-[32px] font-bold text-osa-brand">
                  {data.evalSummary.passed}/{data.evalSummary.total}
                </div>
                <div className="text-[12px] text-osa-faint">{ar ? 'حالات ناجحة' : 'Cases Passed'}</div>
              </div>
              <div className="text-center">
                <div className={`num text-[32px] font-bold ${evalPct !== null && evalPct >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                  {evalPct ?? 0}%
                </div>
                <div className="text-[12px] text-osa-faint">{ar ? 'معدل النجاح' : 'Pass Rate'}</div>
              </div>
              {data.evalSummary.lastRunAt && (
                <div>
                  <div className="text-[13px] text-osa-muted">
                    {ar ? 'آخر تشغيل' : 'Last run'}
                  </div>
                  <div className="num text-[13px] font-semibold text-osa-ink">
                    {formatDate(data.evalSummary.lastRunAt)}
                  </div>
                </div>
              )}
              <div className="ms-auto">
                <code className="block rounded-osa-sm bg-osa-surface-2 px-3 py-2 text-[11.5px] text-osa-muted">
                  deno run scripts/eval-agents.ts
                </code>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 text-[15px] font-bold text-osa-ink">
          {ar ? 'النشاط الأخير' : 'Recent Activity'}
        </h2>
        {data.recentActions.length === 0 ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-[13px] text-osa-faint">
              {ar ? 'لا يوجد نشاط بعد' : 'No activity yet'}
            </p>
          </div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    ar ? 'الوكيل' : 'Agent',
                    ar ? 'الأداة' : 'Tool',
                    ar ? 'الحالة' : 'Status',
                    ar ? 'المخاطرة' : 'Risk',
                    ar ? 'الوقت' : 'Time',
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-osa-border px-4 pb-2.5 pt-3.5 text-start text-[11.5px] font-medium text-osa-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentActions.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-osa-surface-2">
                    <td className="border-b border-osa-border px-4 py-2.5">
                      <span className="rounded-full bg-osa-brand-dim px-2 py-0.5 text-[11.5px] font-semibold text-osa-brand">
                        {AGENT_LABELS[row.agent] ?? row.agent}
                      </span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5 font-mono font-semibold text-osa-ink">
                      {row.tool}
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_COLORS[row.status] ?? 'bg-osa-surface-2 text-osa-muted'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${RISK_COLORS[row.risk] ?? ''}`}
                      >
                        {row.risk}
                      </span>
                    </td>
                    <td className="border-b border-osa-border px-4 py-2.5 text-osa-faint">
                      <span className="num text-[12px]">{formatDate(row.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!data.live && (
        <p className="mt-4 text-center text-[11.5px] text-osa-faint">
          {ar
            ? 'عرض بيانات تجريبية — الاتصال بقاعدة البيانات غير متوفر'
            : 'Showing sample data — database connection unavailable'}
        </p>
      )}
    </RoleGuard>
  );
}
