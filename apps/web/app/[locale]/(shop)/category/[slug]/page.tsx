import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { coerceLocale, localized } from '@/lib/i18n';
import { fetchCategory, fetchProductsWithDisplay } from '@/lib/data';
import { ProductGrid } from '@/components/product-grid';
import { absoluteUrl, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

// ISR: category listings change slowly — revalidate every 5 minutes.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const category = await fetchCategory(slug);
  if (!category) return { title: 'Category' };
  const name = localized(category, 'name', locale);
  const description =
    locale === 'ar'
      ? `تسوّق ${name} من نيوتك — منتجات أصلية بضمان، تركيب احترافي وتوصيل سريع في الكويت.`
      : `Shop ${name} at Newtech — genuine products with warranty, professional installation and fast Kuwait delivery.`;
  const path = `/${locale}/category/${slug}`;
  return {
    title: name,
    description,
    alternates: {
      canonical: path,
      languages: {
        ar: `/ar/category/${slug}`,
        en: `/en/category/${slug}`,
      },
    },
    openGraph: {
      title: name,
      description,
      url: absoluteUrl(path),
      images: category.image_url ? [category.image_url] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  const locale = coerceLocale(raw);
  const category = await fetchCategory(slug);
  if (!category) notFound();
  const items = await fetchProductsWithDisplay({ categoryId: category.id });
  const name = localized(category, 'name', locale);
  const base = `/${locale}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: locale === 'ar' ? 'الرئيسية' : 'Home', url: absoluteUrl(base) },
          { name, url: absoluteUrl(`${base}/category/${slug}`) },
        ])}
      />
      <nav className="mb-2 flex items-center gap-2 text-sm text-muted">
        <Link href={base} className="hover:text-primary">
          {locale === 'ar' ? 'الرئيسية' : 'Home'}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">{name}</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold">{name}</h1>
      <ProductGrid items={items} />
    </div>
  );
}
