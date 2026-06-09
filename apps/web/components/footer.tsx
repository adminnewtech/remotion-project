'use client';

import Link from 'next/link';
import { useT } from '@/lib/use-t';

/** Storefront footer with company info + quick links. */
export function Footer() {
  const { t, locale } = useT();
  const base = `/${locale}`;
  const year = new Date().getFullYear();

  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t('nav.catalog'),
      links: [
        { label: t('catalog.allCategories'), href: `${base}/search` },
        { label: t('catalog.onSale'), href: `${base}/search?sort=sale` },
        { label: t('catalog.bestSellers'), href: `${base}/search?sort=rating` },
      ],
    },
    {
      title: t('nav.account'),
      links: [
        { label: t('nav.orders'), href: `${base}/account` },
        { label: t('nav.support'), href: `${base}/account/support` },
        { label: t('auth.login'), href: `${base}/auth/login` },
      ],
    },
    {
      title: t('support.helpCenter'),
      links: [
        { label: t('support.contactUs'), href: `${base}/account/support` },
        { label: t('orders.warrantyCard'), href: `${base}/account` },
        { label: t('delivery.tracking'), href: `${base}/account` },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-black text-white">E</span>
            <span className="text-lg font-extrabold">Elite<span className="text-accent">.</span></span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            {locale === 'ar'
              ? 'إلكترونيات أصلية، تركيب احترافي، وتوصيل سريع في الكويت.'
              : 'Genuine electronics, professional installation & fast delivery across Kuwait.'}
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-bold">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-sm text-muted transition hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:flex-row">
          <span>© {year} Newtech · newtechq8.com</span>
          <span>KNET · Apple Pay · Google Pay</span>
        </div>
      </div>
    </footer>
  );
}
