/**
 * Elite v1 — full Shopify → Supabase catalog sync (all products, variants,
 * media galleries, inventory, cleaned descriptions). Re-runnable / idempotent.
 *
 * Run via the "Sync Catalog" GitHub Action (needs SHOPIFY_STORE,
 * SHOPIFY_ADMIN_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY secrets).
 */
import { createClient } from '@supabase/supabase-js';

const STORE = process.env.SHOPIFY_STORE!;            // e.g. your-store.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;      // Admin API access token (read_products)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAIN_LOCATION = '00000000-0000-0000-0000-000000000001';

// Shopify productType (Arabic) → Elite category slug.
const CATEGORY_MAP: Record<string, string> = {
  'السيارة وملحقاتها': 'car-accessories',
  'اكسسوارات السيارة': 'car-accessories',
  'معطرات السيارة': 'accessories',
  'البروجكتر وملحقاتة': 'projectors',
  'البروجكتر وملحقاته': 'projectors',
  'البيت الذكي': 'smart-home',
  'مستلزمات السيارة الكهربائية': 'ev-charging',
  'كاميرات المراقبة': 'surveillance',
  'حماية السيارة': 'car-protection',
  'الكترونيات حديثة': 'modern-electronics',
  'الكترونيات': 'modern-electronics',
  'اكسسوارات إلكترونية': 'accessories',
  'كفر هاتف': 'accessories',
  'مروحة يد محمولة': 'accessories',
  'عروض وخصومات': 'offers',
  'خدمة تأجير': 'services',
  'easify_addon_product': 'accessories',
};
// Categories whose products generally require professional installation.
const INSTALL_CATEGORIES = new Set(['smart-home', 'ev-charging', 'surveillance', 'car-protection']);
const INSTALL_TITLE_HINTS = ['شاشة', 'داش كام', 'ai box', 'كارلينكت', 'منظرة', 'ridelux sx', 'ridelux mx'];

const CATEGORIES = [
  ['السيارة وملحقاتها', 'Car & Accessories', 'car-accessories', 1],
  ['البروجكتر وملحقاته', 'Projectors & Accessories', 'projectors', 2],
  ['إلكترونيات حديثة', 'Modern Electronics', 'modern-electronics', 3],
  ['عروض وخصومات', 'Offers & Bundles', 'offers', 4],
  ['البيت الذكي', 'Smart Home', 'smart-home', 5],
  ['مستلزمات السيارة الكهربائية', 'EV Charging', 'ev-charging', 6],
  ['كاميرات المراقبة', 'Surveillance', 'surveillance', 7],
  ['حماية السيارة', 'Car Protection', 'car-protection', 8],
  ['إكسسوارات', 'Accessories', 'accessories', 9],
  ['خدمات', 'Services', 'services', 10],
] as const;

const QUERY = `
query Products($cursor: String) {
  products(first: 40, after: $cursor, query: "status:active") {
    edges { node {
      title handle productType vendor descriptionHtml
      media(first: 10) { edges { node { ... on MediaImage { image { url } } } } }
      variants(first: 30) { edges { node { sku price inventoryQuantity selectedOptions { name value } } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function shopify(cursor?: string) {
  const res = await fetch(`https://${STORE}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query: QUERY, variables: { cursor } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.products;
}

/** Strip <style>/CSS/HTML from Shopify body and return a clean, trimmed description. */
function cleanDescription(html: string): string {
  if (!html) return '';
  let t = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/:root\s*\{[^}]*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/[.#@][-\w][^{}]*\{[^}]*\}/g, ' ') // stray CSS rules
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&quot;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.slice(0, 1200);
}

const slugify = (h: string) => h.toLowerCase().replace(/[^a-z0-9؀-ۿ-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

async function main() {
  for (const k of ['STORE', 'TOKEN', 'SUPABASE_URL', 'SERVICE_KEY'] as const) {
    if (!eval(k)) throw new Error(`Missing required env for ${k}`);
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  await db.from('categories').upsert(
    CATEGORIES.map(([name_ar, name_en, slug, sort]) => ({ name_ar, name_en, slug, sort })),
    { onConflict: 'slug' }
  );
  const { data: catRows } = await db.from('categories').select('id,slug');
  const catId = new Map((catRows ?? []).map((c) => [c.slug, c.id]));

  let cursor: string | undefined;
  let total = 0;
  do {
    const page = await shopify(cursor);
    for (const { node: p } of page.edges) {
      const slug = slugify(p.handle);
      const categorySlug = CATEGORY_MAP[(p.productType || '').trim()] ?? 'accessories';
      const titleLc = p.title.toLowerCase();
      const requiresInstall =
        INSTALL_CATEGORIES.has(categorySlug) || INSTALL_TITLE_HINTS.some((h) => titleLc.includes(h));
      const fee = requiresInstall ? (categorySlug === 'car-protection' ? 0 : 8) : 0;

      const { data: prod } = await db
        .from('products')
        .upsert(
          {
            slug,
            name_ar: p.title,
            name_en: p.title,
            description_ar: cleanDescription(p.descriptionHtml),
            description_en: cleanDescription(p.descriptionHtml),
            brand: p.vendor || 'Newtech',
            category_id: catId.get(categorySlug) ?? null,
            requires_installation: requiresInstall,
            installation_fee: fee,
            warranty_months: 12,
            is_active: true,
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();
      if (!prod) continue;

      // Media gallery
      const images: string[] = (p.media?.edges ?? [])
        .map((e: any) => e.node?.image?.url)
        .filter(Boolean);
      let sort = 0;
      for (const url of images) {
        await db.from('product_media').upsert(
          { product_id: prod.id, url, kind: 'image', sort: sort++ },
          { onConflict: 'product_id,url', ignoreDuplicates: true } as never
        );
      }

      // Variants + inventory
      for (const { node: v } of p.variants.edges) {
        const sku = v.sku || `${slug}-${(v.selectedOptions ?? []).map((o: any) => o.value).join('-') || 'default'}`;
        const attrs = Object.fromEntries((v.selectedOptions ?? []).map((o: any) => [o.name, o.value]));
        const { data: variant } = await db
          .from('product_variants')
          .upsert({ product_id: prod.id, sku, price: Number(v.price), attributes: attrs }, { onConflict: 'sku' })
          .select('id')
          .single();
        if (variant) {
          await db.from('inventory').upsert(
            { variant_id: variant.id, location_id: MAIN_LOCATION, on_hand: Math.max(0, v.inventoryQuantity ?? 0) },
            { onConflict: 'variant_id,location_id' }
          );
        }
      }
      total++;
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
    process.stdout.write(`\rSynced ${total} products...`);
  } while (cursor);

  console.log(`\nDone. Synced ${total} active products from Shopify → Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
