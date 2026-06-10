import * as React from 'react';

import { cn } from './cn';

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Current page (1-based). */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Number of sibling pages to show around the current page. */
  siblingCount?: number;
  prevLabel?: string;
  nextLabel?: string;
}

const DOTS = 'dots' as const;

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** Build the page list with ellipses, e.g. [1, 'dots', 4,5,6, 'dots', 20]. */
function paginate(page: number, pageCount: number, siblingCount: number): (number | typeof DOTS)[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (pageCount <= totalNumbers) return range(1, pageCount);

  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, pageCount);
  const showLeftDots = left > 2;
  const showRightDots = right < pageCount - 1;

  if (!showLeftDots && showRightDots) {
    return [...range(1, 3 + siblingCount * 2), DOTS, pageCount];
  }
  if (showLeftDots && !showRightDots) {
    return [1, DOTS, ...range(pageCount - (2 + siblingCount * 2), pageCount)];
  }
  return [1, DOTS, ...range(left, right), DOTS, pageCount];
}

/** RTL-aware chevron (mirrors with direction). */
function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  );
}

const itemBase =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50';

/**
 * Page navigation. Prev/next chevrons mirror under RTL so they always point
 * toward the logical previous/next page. Controlled via `page`/`onPageChange`.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  className,
  ...props
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = paginate(page, pageCount, siblingCount);

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)} {...props}>
      <button
        type="button"
        className={cn(itemBase, 'text-muted hover:bg-neutral-100')}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={prevLabel}
      >
        <Chevron dir="prev" />
      </button>
      {pages.map((p, i) =>
        p === DOTS ? (
          <span key={`dots-${i}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPageChange(p)}
            className={cn(
              itemBase,
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-neutral-100',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(itemBase, 'text-muted hover:bg-neutral-100')}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label={nextLabel}
      >
        <Chevron dir="next" />
      </button>
    </nav>
  );
}
