import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '@/lib/i18n';
import type { Locale } from '@elite/types';

/**
 * Shared section heading for the homepage rails. Accent eyebrow + bold title,
 * optional subtitle, optional "see all" link. Pure presentational (server-safe).
 */
export function SectionHeader({
  title,
  subtitle,
  href,
  locale,
  eyebrow,
  icon,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  locale: Locale;
  eyebrow?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <span className="mb-1 inline-block text-xs font-bold uppercase tracking-widest text-accent-600">
            {eyebrow}
          </span>
        )}
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-foreground sm:text-2xl">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-primary transition hover:bg-primary-50"
        >
          {t('common.seeAll', locale)}
          <svg
            className="transition group-hover:translate-x-0.5 rtl:rotate-180"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      )}
    </div>
  );
}
