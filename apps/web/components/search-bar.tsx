'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/lib/use-t';

/** Storefront search box; submits to the /search route. */
export function SearchBar({ className = '' }: { className?: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(`/${locale}/search${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  }

  return (
    <form onSubmit={submit} className={`relative flex-1 ${className}`} role="search">
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('catalog.searchPlaceholder')}
        className="w-full rounded-full border border-border bg-surface py-2.5 ps-10 pe-4 text-sm outline-none transition focus:border-primary focus:shadow-focus"
      />
    </form>
  );
}
