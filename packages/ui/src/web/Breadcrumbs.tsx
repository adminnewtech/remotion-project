import * as React from 'react';

import { cn } from './cn';

export interface BreadcrumbItem {
  label: React.ReactNode;
  href?: string;
  /** Marks the current page (rendered non-interactive). */
  current?: boolean;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** Separator node. Defaults to a chevron that flips correctly under RTL. */
  separator?: React.ReactNode;
}

/** RTL-aware chevron separator (mirrors with the document direction). */
function DefaultSeparator() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-neutral-400 rtl:-scale-x-100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/**
 * Breadcrumb trail. Uses an ordered list inside a labelled nav; the separator
 * mirrors automatically under RTL so the trail reads start→end in both locales.
 */
export function Breadcrumbs({ items, separator, className, ...props }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className} {...props}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const current = item.current ?? isLast;
          return (
            <li key={i} className="inline-flex items-center gap-1.5">
              {item.href && !current ? (
                <a
                  href={item.href}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={cn(current ? 'font-medium text-foreground' : 'text-muted')}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (separator ?? <DefaultSeparator />)}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
