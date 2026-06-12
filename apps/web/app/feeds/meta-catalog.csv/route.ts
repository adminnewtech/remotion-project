/**
 * Meta / Facebook Commerce Manager catalog feed — CSV.
 *
 * Columns: id,title,description,availability,condition,price,link,image_link,brand
 * (the exact field names Commerce Manager auto-maps). Arabic-first text, served
 * with `text/csv; charset=utf-8` and a UTF-8 BOM so Arabic opens correctly when
 * the file is downloaded and opened in Excel. Backed by the shared feeds seam
 * (live Supabase catalog, sample fallback).
 *
 * Submit this URL in Commerce Manager → Catalog → Data sources → Scheduled feed.
 */
import { fetchCatalogItems, feedPrice, feedProductLink } from '@/lib/feeds';

export const revalidate = 3600;
export const dynamic = 'force-static';

const COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
] as const;

/** RFC-4180 CSV cell: always quote, double inner quotes. */
function cell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET() {
  const items = await fetchCatalogItems();

  const rows = items.map((item) =>
    [
      item.id,
      item.titleAr,
      item.descriptionAr,
      item.availability,
      'new',
      feedPrice(item.price),
      feedProductLink(item.product.slug),
      item.image ?? '',
      item.brand ?? '',
    ]
      .map(cell)
      .join(','),
  );

  // UTF-8 BOM so Excel detects UTF-8 and renders Arabic correctly. \r\n line
  // endings per RFC 4180.
  const body = '﻿' + [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';

  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'inline; filename="meta-catalog.csv"',
      'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
