/**
 * Google Merchant Center product feed — RSS 2.0 with the `g:` namespace.
 *
 * Emits every active product (Arabic-first title/description) with the fields
 * Merchant Center requires: id, title, description, link, image_link, price,
 * availability, brand, condition, and `identifier_exists: false` when no GTIN
 * is known. Served from the live Supabase catalog via the shared feeds seam,
 * with a sample fallback so the build never breaks.
 *
 * Submit this URL in Merchant Center → Products → Feeds (scheduled fetch).
 */
import { fetchCatalogItems, feedPrice, feedProductLink, FEED_SITE_URL } from '@/lib/feeds';

// Re-fetch hourly (ISR for route handlers).
export const revalidate = 3600;
export const dynamic = 'force-static';

/** Escape the five XML predefined entities for text/CDATA-free content. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const items = await fetchCatalogItems();

  const entries = items
    .map((item) => {
      const link = feedProductLink(item.product.slug);
      const lines = [
        `<g:id>${xml(item.id)}</g:id>`,
        `<g:title>${xml(item.titleAr)}</g:title>`,
        `<g:description>${xml(item.descriptionAr)}</g:description>`,
        `<g:link>${xml(link)}</g:link>`,
        `<link>${xml(link)}</link>`,
        item.image ? `<g:image_link>${xml(item.image)}</g:image_link>` : '',
        `<g:price>${xml(feedPrice(item.price))}</g:price>`,
        `<g:availability>${item.availability}</g:availability>`,
        `<g:condition>new</g:condition>`,
        item.brand ? `<g:brand>${xml(item.brand)}</g:brand>` : '',
        item.hasGtin && item.gtin ? `<g:gtin>${xml(item.gtin)}</g:gtin>` : '',
        `<g:identifier_exists>${item.hasGtin ? 'yes' : 'no'}</g:identifier_exists>`,
      ].filter(Boolean);
      return `    <item>\n      ${lines.join('\n      ')}\n    </item>`;
    })
    .join('\n');

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>Newtech Kuwait — نيوتك</title>\n` +
    `    <link>${FEED_SITE_URL}</link>\n` +
    `    <description>Genuine electronics with professional installation in Kuwait — إلكترونيات أصلية مع تركيب احترافي.</description>\n` +
    `${entries}\n` +
    `  </channel>\n` +
    `</rss>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
