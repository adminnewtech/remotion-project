import type { MetadataRoute } from 'next';
import { fetchAllProducts, fetchCategories } from '@/lib/data';
import { SITE_URL } from '@/lib/seo';
import { LOCALES } from '@/lib/i18n';

/**
 * Sitemap with category + product URLs for both locales, pulled live from
 * Supabase via @elite/core (falls back to sample data when env is absent).
 * Each URL advertises its ar/en alternates for hreflang.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([fetchCategories(), fetchAllProducts()]);
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  const altLanguages = (path: string) =>
    Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]));

  // Static / top-level pages.
  const staticPaths = ['', '/search', '/cart'];
  for (const p of staticPaths) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        lastModified: now,
        changeFrequency: p === '' ? 'daily' : 'weekly',
        priority: p === '' ? 1 : 0.6,
        alternates: { languages: altLanguages(p) },
      });
    }
  }

  // Categories.
  for (const c of categories) {
    const path = `/category/${c.slug}`;
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: altLanguages(path) },
      });
    }
  }

  // Products.
  for (const p of products) {
    const path = `/product/${p.slug}`;
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates: { languages: altLanguages(path) },
      });
    }
  }

  return entries;
}
