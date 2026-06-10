/**
 * Elite v1 — Shopify → Supabase catalog sync.
 *
 * Pulls products from the Newtech Shopify store and upserts them into the
 * Elite v1 commerce tables (categories, products, product_variants, inventory,
 * product_media). This is the script behind the initial catalog seed; re-run it
 * to refresh the catalog, or wire it to a Shopify webhook for live sync.
 *
 * Usage:
 *   SHOPIFY_STORE=newtechq8.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   SUPABASE_URL=https://wslvotaodwdftmexkfpd.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/sync-shopify-catalog.ts
 *
 * Notes:
 * - Uses the service role key (server-side only) to bypass RLS for writes.
 * - Maps Shopify `productType` → Elite category slug.
 * - Car screens / dashcams / AI boxes are flagged `requires_installation`.
 */
import { createClient } from '@supabase/supabase-js';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE!;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAIN_LOCATION = '00000000-0000-0000-0000-000000000001';

const CATEGORY_MAP: Record<string, string> = {
  'السيارة وملحقاتها': 'car-accessories',
  'البروجكتر وملحقاتة': 'projectors',
  'البروجكتر وملحقاته': 'projectors',
  'الكترونيات حديثة': 'modern-electronics',
  'الكترونيات': 'modern-electronics',
  'عروض وخصومات': 'offers',
};

const INSTALL_HINTS = ['شاشة', 'داش كام', 'ai box', 'كارلينكت', 'منظرة', 'ridelux', 'مقاعد'];

const SHOPIFY_GQL = `
query Products($cursor: String) {
  products(first: 50, after: $cursor, query: "status:active") {
    edges { node {
      title handle productType vendor status
      featuredMedia { preview { image { url } } }
      variants(first: 20) { edges { node { sku price inventoryQuantity selectedOptions { name value } } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function shopify(cursor?: string) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN },
    body: JSON.stringify({ query: SHOPIFY_GQL, variables: { cursor } }),
  });
  const json = await res.json();
  return json.data.products;
}

function slugify(handle: string) {
  return handle.toLowerCase().replace(/[^a-z0-9؀-ۿ-]+/g, '-').slice(0, 80);
}

async function main() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Ensure categories exist
  const cats = [
    { name_ar: 'السيارة وملحقاتها', name_en: 'Car & Accessories', slug: 'car-accessories', sort: 1 },
    { name_ar: 'البروجكتر وملحقاته', name_en: 'Projectors & Accessories', slug: 'projectors', sort: 2 },
    { name_ar: 'إلكترونيات حديثة', name_en: 'Modern Electronics', slug: 'modern-electronics', sort: 3 },
    { name_ar: 'عروض وخصومات', name_en: 'Offers & Bundles', slug: 'offers', sort: 4 },
  ];
  await db.from('categories').upsert(cats, { onConflict: 'slug' });
  const { data: catRows } = await db.from('categories').select('id,slug');
  const catId = new Map((catRows ?? []).map((c) => [c.slug, c.id]));

  let cursor: string | undefined;
  let total = 0;
  do {
    const page = await shopify(cursor);
    for (const { node: p } of page.edges) {
      const slug = slugify(p.handle);
      const categorySlug = CATEGORY_MAP[p.productType?.trim()] ?? 'modern-electronics';
      const requiresInstall = INSTALL_HINTS.some((h) => p.title.toLowerCase().includes(h));

      const { data: prod } = await db
        .from('products')
        .upsert(
          {
            slug,
            name_ar: p.title,
            name_en: p.title,
            brand: p.vendor,
            category_id: catId.get(categorySlug) ?? null,
            requires_installation: requiresInstall,
            installation_fee: requiresInstall ? 5 : 0,
            warranty_months: 12,
            is_active: p.status === 'ACTIVE',
          },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();
      if (!prod) continue;

      const img = p.featuredMedia?.preview?.image?.url;
      if (img) {
        await db.from('product_media').upsert(
          { product_id: prod.id, url: img, kind: 'image', sort: 0 },
          { onConflict: 'product_id,url' as never } // best-effort; ignore dup
        );
      }

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
  } while (cursor);

  console.log(`Synced ${total} products from Shopify → Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
