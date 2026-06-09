'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Category } from '@elite/types';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { LanguageSwitch } from '@/components/language-switch';
import { CartButton } from '@/components/cart-button';
import { SearchBar } from '@/components/search-bar';

/** Storefront top navigation: brand, search, categories, language + cart. */
export function Header({ categories }: { categories: Category[] }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100 md:hidden"
          aria-label={t('common.more')}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <Link href={base} className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-white">E</span>
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">
            Elite<span className="text-accent">.</span>
          </span>
        </Link>

        <div className="mx-2 hidden flex-1 md:flex">
          <SearchBar />
        </div>

        <nav className="ms-auto flex items-center gap-2">
          <LanguageSwitch />
          <Link
            href={`${base}/account`}
            aria-label={t('nav.account')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-primary hover:text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
            </svg>
          </Link>
          <CartButton />
        </nav>
      </div>

      {/* Mobile search */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>

      {/* Category bar */}
      <div className={`border-t border-border ${open ? 'block' : 'hidden md:block'}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-4 py-2">
          <Link href={`${base}/search`} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-neutral-100 hover:text-foreground">
            {t('catalog.allCategories')}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`${base}/category/${c.slug}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-neutral-100 hover:text-foreground"
            >
              {localized(c, 'name', locale)}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
