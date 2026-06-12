// Elite v1 — Shopify → Supabase catalog sync (Edge Function).
// Deno runtime.
//
// Idempotent, ops-triggered catalog sync that keeps our first-party catalog in
// step with the Newtech Shopify store WITHOUT clobbering our curation:
//   • NEW products are inserted with a mapped category + install flag.
//   • EXISTING products (matched by slug) only get price / sale / stock / image
//     refreshed — their curated category_id and copy are preserved.
// Descriptions are cleaned of the Shopify CSS/HTML blobs. Variant SKUs are made
// unique (Shopify reuses one SKU across option rows). compareAtPrice → our
// regular price with the live price stored as sale_price.
//
// Env (function secrets): SHOPIFY_STORE (e.g. newtechq8.myshopify.com),
// SHOPIFY_ADMIN_TOKEN (shpat_…). Auth: caller must be an ops user (admin/
// employee) OR send the service-role key as a Bearer token.

import { serve } from "https://deno.land/std/http/server.ts";
import { handlePreflight, json, jsonError } from "../_shared/cors.ts";
import { getAdminClient, getUserFromRequest } from "../_shared/supabaseAdmin.ts";

const SHOPIFY_STORE = Deno.env.get("SHOPIFY_STORE") ?? "";
const SHOPIFY_ADMIN_TOKEN = Deno.env.get("SHOPIFY_ADMIN_TOKEN") ?? "";
const MAIN_LOCATION = "00000000-0000-0000-0000-000000000001";

// Shopify productType → our curated category slug. Unknown types fall back to
// 'modern-electronics'. New slugs here must exist in `categories`.
const CATEGORY_MAP: Record<string, string> = {
  "السيارة وملحقاتها": "car-accessories",
  "البروجكتر وملحقاتة": "projectors",
  "البروجكتر وملحقاته": "projectors",
  "الكترونيات حديثة": "modern-electronics",
  "الكترونيات": "modern-electronics",
  "عروض وخصومات": "offers",
  "البيت الذكي": "smart-home",
  "خدمات": "services",
};

const INSTALL_CATEGORIES = new Set(["car-accessories", "smart-home"]);
const INSTALL_HINTS = ["شاشة", "داش كام", "ai box", "كارلينكت", "منظرة", "ridelux", "مقاعد", "قفل", "إنتركم", "انتركم", "كاميرا"];

const SHOPIFY_GQL = `
query Products($cursor: String) {
  products(first: 50, after: $cursor, query: "status:active") {
    edges { node {
      title handle productType vendor status descriptionHtml
      media(first: 8) { edges { node { ... on MediaImage { image { url } } } } }
      variants(first: 30) { edges { node {
        sku price compareAtPrice inventoryQuantity barcode
        selectedOptions { name value }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface ShopVariant {
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  barcode: string | null;
  selectedOptions: { name: string; value: string }[];
}
interface ShopProduct {
  title: string;
  handle: string;
  productType: string | null;
  vendor: string | null;
  status: string;
  descriptionHtml: string | null;
  media: { edges: { node: { image?: { url: string } } }[] };
  variants: { edges: { node: ShopVariant }[] };
}

async function shopify(cursor?: string) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN },
    body: JSON.stringify({ query: SHOPIFY_GQL, variables: { cursor } }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  const jsonRes = await res.json();
  if (jsonRes.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(jsonRes.errors)}`);
  return jsonRes.data.products as { edges: { node: ShopProduct }[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
}

function slugify(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9؀-ۿ-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Strip the Shopify `:root{…}` CSS blob + HTML tags → clean plain text. */
function cleanDescription(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/:root\s*\{[\s\S]*?\}/g, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1500);
}

interface SyncSummary {
  pages: number;
  created: number;
  updated: number;
  variants: number;
  images: number;
}

async function run(): Promise<SyncSummary> {
  if (!SHOPIFY_STORE || !SHOPIFY_ADMIN_TOKEN) {
    throw new Error("SHOPIFY_STORE / SHOPIFY_ADMIN_TOKEN not configured");
  }
  const db = getAdminClient();

  const { data: catRows } = await db.from("categories").select("id, slug");
  const catId = new Map<string, string>((catRows ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]));

  const summary: SyncSummary = { pages: 0, created: 0, updated: 0, variants: 0, images: 0 };
  let cursor: string | undefined;

  do {
    const page = await shopify(cursor);
    summary.pages += 1;

    for (const { node: p } of page.edges) {
      const slug = slugify(p.handle);
      const categorySlug = CATEGORY_MAP[(p.productType ?? "").trim()] ?? "modern-electronics";
      const title = p.title.toLowerCase();
      const requiresInstall =
        INSTALL_CATEGORIES.has(categorySlug) || INSTALL_HINTS.some((h) => title.includes(h));
      const description = cleanDescription(p.descriptionHtml);

      // Insert vs preserve-curation update. Match by SKU first (robust — our
      // curated slugs don't always equal the Shopify handle), then by slug.
      const rawSkus = p.variants.edges
        .map((e) => (e.node.sku ?? "").trim())
        .filter((s) => s.length > 0);
      let existingId: string | null = null;
      if (rawSkus.length) {
        const { data: vmatch } = await db
          .from("product_variants")
          .select("product_id")
          .in("sku", rawSkus)
          .limit(1)
          .maybeSingle();
        if (vmatch?.product_id) existingId = vmatch.product_id as string;
      }
      if (!existingId) {
        const { data: existing } = await db.from("products").select("id").eq("slug", slug).maybeSingle();
        if (existing?.id) existingId = existing.id as string;
      }

      let productId: string;
      if (existingId) {
        productId = existingId;
        await db
          .from("products")
          .update({
            name_ar: p.title,
            brand: p.vendor,
            description_ar: description || null,
            is_active: p.status === "ACTIVE",
            // category_id intentionally preserved (curation).
          })
          .eq("id", productId);
        summary.updated += 1;
      } else {
        const { data: ins } = await db
          .from("products")
          .insert({
            slug,
            name_ar: p.title,
            name_en: p.title,
            brand: p.vendor,
            description_ar: description || null,
            category_id: catId.get(categorySlug) ?? null,
            requires_installation: requiresInstall,
            installation_fee: requiresInstall ? 5 : 0,
            warranty_months: 12,
            is_active: p.status === "ACTIVE",
          })
          .select("id")
          .single();
        if (!ins) continue;
        productId = ins.id as string;
        summary.created += 1;
      }

      // ── Media (multiple images) ──────────────────────────────
      const imageUrls = p.media.edges.map((e) => e.node?.image?.url).filter((u): u is string => !!u);
      let sort = 0;
      for (const url of imageUrls.slice(0, 8)) {
        const { data: existsImg } = await db
          .from("product_media")
          .select("id")
          .eq("product_id", productId)
          .eq("url", url)
          .maybeSingle();
        if (!existsImg) {
          await db.from("product_media").insert({ product_id: productId, url, kind: "image", sort });
          summary.images += 1;
        }
        sort += 1;
      }

      // ── Variants (unique SKU, sale price, inventory) ─────────
      const seenSkus = new Set<string>();
      let vIdx = 0;
      for (const { node: v } of p.variants.edges) {
        const optionLabel = (v.selectedOptions ?? []).map((o) => o.value).join(" / ");
        let sku = (v.sku ?? "").trim();
        if (!sku || seenSkus.has(sku)) {
          sku = `${sku || slug}-${vIdx}`; // de-dupe Shopify's reused/empty SKUs
        }
        seenSkus.add(sku);
        vIdx += 1;

        const price = Number(v.price);
        const compareAt = v.compareAtPrice ? Number(v.compareAtPrice) : null;
        // Shopify: price = selling price, compareAtPrice = original (higher).
        const regular = compareAt && compareAt > price ? compareAt : price;
        const sale = compareAt && compareAt > price ? price : null;
        const attrs = Object.fromEntries((v.selectedOptions ?? []).map((o) => [o.name, o.value]));
        if (optionLabel && optionLabel !== "Default Title") attrs["label"] = optionLabel;

        const { data: variant } = await db
          .from("product_variants")
          .upsert(
            {
              product_id: productId,
              sku,
              attributes: attrs,
              price: regular,
              sale_price: sale,
              barcode: v.barcode || null,
              is_active: true,
            },
            { onConflict: "sku" },
          )
          .select("id")
          .single();
        if (variant) {
          summary.variants += 1;
          await db.from("inventory").upsert(
            {
              variant_id: variant.id,
              location_id: MAIN_LOCATION,
              on_hand: Math.max(0, v.inventoryQuantity ?? 0),
            },
            { onConflict: "variant_id,location_id" },
          );
        }
      }
    }

    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
  } while (cursor);

  return summary;
}

serve(async (req: Request): Promise<Response> => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  // Authorize: ops user (admin/employee) — service-role bearer also passes.
  try {
    const user = await getUserFromRequest(req);
    if (user.role !== "admin" && user.role !== "employee") {
      return jsonError("Forbidden — ops only", 403);
    }
  } catch {
    return jsonError("Unauthorized", 401);
  }

  try {
    const summary = await run();
    return json({ ok: true, ...summary });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "sync failed", 500);
  }
});
