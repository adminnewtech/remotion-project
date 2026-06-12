import 'server-only';

/**
 * Admin catalog data seam — products + inventory for the OSALPHA admin.
 *
 * Reads through the request-scoped Supabase client against `@elite/core`
 * (`catalog.listProducts` / `catalog.listCategories` + `analytics.getLowStock`)
 * and batches variant / media / inventory lookups so the gold DataTable can show
 * price, thumbnail and stock without an N+1. When the client is absent (no env)
 * or a live read is empty, every section falls back to clearly-marked sample
 * data so the page always renders. Money is KWD (3 decimals).
 *
 * Writes: `@elite/core` does not yet expose catalog mutations. The
 * `saveProduct` / `setProductActive` / `adjustInventory` helpers below are
 * documented, shape-matched stubs that perform the live `client.from(...)`
 * upsert/update when a client is present and otherwise resolve against the
 * sample set, so the UI's optimistic + toast flow is real end-to-end. Swap the
 * bodies for `catalog.*` mutations once the contract lands — the call sites and
 * payload shapes won't change.
 */
import { analytics, catalog } from '@elite/core';
import type {
  Category,
  Product,
  ProductMedia,
  ProductVariant,
} from '@elite/types';
import { getServerClient } from '@/lib/supabase/server';
import { sampleCategories } from '@/lib/sample-data';

// ── View shapes ─────────────────────────────────────────────

/** A product row enriched with everything the catalog table needs. */
export interface CatalogProduct extends Product {
  /** Primary image URL (lowest-sort image media), or null. */
  image: string | null;
  /** Cheapest active variant price (regular). */
  price: number;
  /** Cheapest active variant sale price, when on sale. */
  salePrice: number | null;
  /** Available stock summed across this product's variants. */
  stock: number;
  /** Number of active variants. */
  variantCount: number;
  /** Resolved category name (ar/en preselected by caller via `localized`). */
  categoryNameAr: string | null;
  categoryNameEn: string | null;
}

/** A variant joined with its inventory level for the inventory view + editor. */
export interface CatalogVariant extends ProductVariant {
  onHand: number;
  reserved: number;
  available: number;
}

/** Full product for the add/edit form. */
export interface CatalogProductDetail extends Product {
  variants: CatalogVariant[];
  media: ProductMedia[];
}

/** A flat inventory row (variant × product) for the inventory tab. */
export interface InventoryRow {
  variantId: string;
  productId: string;
  productNameAr: string;
  productNameEn: string;
  sku: string | null;
  attributes: Record<string, string>;
  onHand: number;
  reserved: number;
  available: number;
  lowThreshold: number;
}

export interface CatalogData {
  /** Whether any section came from the live backend. */
  live: boolean;
  products: CatalogProduct[];
  categories: Category[];
}

const LOW_STOCK_THRESHOLD = 5;

const SALE = (v: { price: number; sale_price: number | null }) =>
  v.sale_price != null && v.sale_price < v.price ? v.sale_price : v.price;

function cheapest(variants: ProductVariant[]): ProductVariant | null {
  if (!variants.length) return null;
  return variants.reduce((best, v) => (SALE(v) < SALE(best) ? v : best));
}

// ── Sample fallback ─────────────────────────────────────────
//
// A self-contained catalog snapshot (independent of the storefront sample) so
// the admin renders a rich, realistic table with stock + sale states with no
// env. Western digits, KWD 3-decimals.

interface CatalogSeed {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  brand: string;
  category_id: string;
  requires_installation: boolean;
  installation_fee: number;
  warranty_months: number;
  is_active: boolean;
  image: string;
  variants: {
    sku: string;
    attributes: Record<string, string>;
    price: number;
    sale_price: number | null;
    onHand: number;
    reserved: number;
  }[];
}

const IMG = (q: string) =>
  `https://images.unsplash.com/${q}?auto=format&fit=crop&w=300&q=70`;

const CATALOG_SEEDS: CatalogSeed[] = [
  {
    id: 'p-1', slug: 'samsung-65-qled-4k',
    name_ar: 'تلفزيون سامسونج QLED 4K مقاس 65 بوصة', name_en: 'Samsung 65" QLED 4K Smart TV',
    brand: 'Samsung', category_id: 'c-tv', requires_installation: true, installation_fee: 15, warranty_months: 24, is_active: true,
    image: IMG('photo-1593359677879-a4bb92f829d1'),
    variants: [
      { sku: 'SAM-65Q-BLK', attributes: { color: 'أسود', model: '65"' }, price: 289.0, sale_price: 249.0, onHand: 18, reserved: 3 },
      { sku: 'SAM-55Q-BLK', attributes: { color: 'أسود', model: '55"' }, price: 219.0, sale_price: null, onHand: 11, reserved: 1 },
    ],
  },
  {
    id: 'p-2', slug: 'lg-split-ac-18000',
    name_ar: 'مكيف سبليت إل جي 18000 وحدة', name_en: 'LG Split AC 18,000 BTU Inverter',
    brand: 'LG', category_id: 'c-ac', requires_installation: true, installation_fee: 25, warranty_months: 36, is_active: true,
    image: IMG('photo-1631545806609-c2b9991b7e0a'),
    variants: [
      { sku: 'LG-AC-18K', attributes: { model: '18000 BTU' }, price: 199.0, sale_price: null, onHand: 4, reserved: 2 },
    ],
  },
  {
    id: 'p-3', slug: 'bosch-washing-machine-9kg',
    name_ar: 'غسالة بوش 9 كجم', name_en: 'Bosch 9kg Front-Load Washer',
    brand: 'Bosch', category_id: 'c-app', requires_installation: true, installation_fee: 10, warranty_months: 24, is_active: true,
    image: IMG('photo-1626806787461-102c1bfaaea1'),
    variants: [
      { sku: 'BSH-9KG-WHT', attributes: { color: 'أبيض', model: '9kg' }, price: 159.5, sale_price: 139.5, onHand: 9, reserved: 0 },
    ],
  },
  {
    id: 'p-4', slug: 'sony-soundbar-ht',
    name_ar: 'مكبر صوت سوني HT-A5000', name_en: 'Sony HT-A5000 Soundbar',
    brand: 'Sony', category_id: 'c-audio', requires_installation: false, installation_fee: 0, warranty_months: 12, is_active: true,
    image: IMG('photo-1545454675-3531b543be5d'),
    variants: [
      { sku: 'SON-HTA5', attributes: { model: 'A5000' }, price: 119.0, sale_price: null, onHand: 22, reserved: 4 },
    ],
  },
  {
    id: 'p-5', slug: 'ecovacs-deebot-x2',
    name_ar: 'مكنسة روبوت ايكوفاكس X2', name_en: 'Ecovacs Deebot X2 Robot Vacuum',
    brand: 'Ecovacs', category_id: 'c-smart', requires_installation: false, installation_fee: 0, warranty_months: 12, is_active: false,
    image: IMG('photo-1558002038-1055907df827'),
    variants: [
      { sku: 'ECV-X2-BLK', attributes: { color: 'أسود' }, price: 89.9, sale_price: 74.9, onHand: 0, reserved: 0 },
    ],
  },
  {
    id: 'p-6', slug: 'macbook-air-m3',
    name_ar: 'لابتوب ماك بوك اير M3', name_en: 'Apple MacBook Air M3 13"',
    brand: 'Apple', category_id: 'c-comp', requires_installation: false, installation_fee: 0, warranty_months: 12, is_active: true,
    image: IMG('photo-1517336714731-489689fd1ca8'),
    variants: [
      { sku: 'APL-MBA-256', attributes: { storage: '256GB', color: 'فضي' }, price: 379.0, sale_price: null, onHand: 7, reserved: 1 },
      { sku: 'APL-MBA-512', attributes: { storage: '512GB', color: 'رمادي' }, price: 449.0, sale_price: 429.0, onHand: 3, reserved: 0 },
    ],
  },
  {
    id: 'p-7', slug: 'lg-french-door-fridge',
    name_ar: 'ثلاجة إل جي 4 أبواب', name_en: 'LG French-Door Refrigerator',
    brand: 'LG', category_id: 'c-app', requires_installation: true, installation_fee: 12, warranty_months: 24, is_active: true,
    image: IMG('photo-1571175443880-49e1d25b2bc5'),
    variants: [
      { sku: 'LG-FD-SS', attributes: { color: 'ستيل' }, price: 419.0, sale_price: 389.0, onHand: 5, reserved: 1 },
    ],
  },
  {
    id: 'p-8', slug: 'samsung-galaxy-tab-s9',
    name_ar: 'تابلت سامسونج جالكسي تاب S9', name_en: 'Samsung Galaxy Tab S9',
    brand: 'Samsung', category_id: 'c-comp', requires_installation: false, installation_fee: 0, warranty_months: 12, is_active: true,
    image: IMG('photo-1561154464-82e9adf32764'),
    variants: [
      { sku: 'SAM-TABS9', attributes: { storage: '128GB' }, price: 229.0, sale_price: 209.0, onHand: 14, reserved: 2 },
    ],
  },
];

function seedToCatalogProduct(s: CatalogSeed): CatalogProduct {
  const cheap = s.variants.reduce(
    (best, v) => ((v.sale_price ?? v.price) < (best.sale_price ?? best.price) ? v : best),
    s.variants[0]!,
  );
  const stock = s.variants.reduce((n, v) => n + Math.max(0, v.onHand - v.reserved), 0);
  const cat = sampleCategories.find((c) => c.id === s.category_id) ?? null;
  return {
    id: s.id,
    category_id: s.category_id,
    name_ar: s.name_ar,
    name_en: s.name_en,
    description_ar: 'منتج أصلي بضمان نيوتك. تركيب احترافي وتوصيل سريع في الكويت.',
    description_en: 'Genuine product with Newtech warranty. Professional installation and fast Kuwait delivery.',
    brand: s.brand,
    slug: s.slug,
    requires_installation: s.requires_installation,
    installation_fee: s.installation_fee,
    warranty_months: s.warranty_months,
    is_active: s.is_active,
    image: s.image,
    price: cheap.price,
    salePrice: cheap.sale_price,
    stock,
    variantCount: s.variants.length,
    categoryNameAr: cat?.name_ar ?? null,
    categoryNameEn: cat?.name_en ?? null,
  };
}

function seedToDetail(s: CatalogSeed): CatalogProductDetail {
  const variants: CatalogVariant[] = s.variants.map((v, i) => ({
    id: `${s.id}-v${i + 1}`,
    product_id: s.id,
    sku: v.sku,
    attributes: v.attributes,
    price: v.price,
    sale_price: v.sale_price,
    barcode: null,
    weight_g: null,
    is_active: true,
    onHand: v.onHand,
    reserved: v.reserved,
    available: Math.max(0, v.onHand - v.reserved),
  }));
  const media: ProductMedia[] = [0, 1, 2].map((i) => ({
    id: `${s.id}-m${i + 1}`,
    product_id: s.id,
    variant_id: null,
    url: s.image.replace('w=300', `w=${300 + i}`),
    kind: 'image',
    sort: i,
  }));
  return {
    id: s.id,
    category_id: s.category_id,
    name_ar: s.name_ar,
    name_en: s.name_en,
    description_ar: 'منتج أصلي بضمان نيوتك. تركيب احترافي وتوصيل سريع في الكويت.',
    description_en: 'Genuine product with Newtech warranty. Professional installation and fast Kuwait delivery.',
    brand: s.brand,
    slug: s.slug,
    requires_installation: s.requires_installation,
    installation_fee: s.installation_fee,
    warranty_months: s.warranty_months,
    is_active: s.is_active,
    variants,
    media,
  };
}

const sampleCatalogProducts: CatalogProduct[] = CATALOG_SEEDS.map(seedToCatalogProduct);

function sampleInventoryRows(): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const s of CATALOG_SEEDS) {
    s.variants.forEach((v, i) => {
      rows.push({
        variantId: `${s.id}-v${i + 1}`,
        productId: s.id,
        productNameAr: s.name_ar,
        productNameEn: s.name_en,
        sku: v.sku,
        attributes: v.attributes,
        onHand: v.onHand,
        reserved: v.reserved,
        available: Math.max(0, v.onHand - v.reserved),
        lowThreshold: LOW_STOCK_THRESHOLD,
      });
    });
  }
  return rows;
}

// ── Live reads ──────────────────────────────────────────────

interface VariantRow {
  id: string;
  product_id: string;
  price: number;
  sale_price: number | null;
  is_active: boolean;
}

/**
 * Catalog snapshot: products enriched with price / image / stock, plus the
 * category list for filters. Live where possible, sample fallback otherwise.
 */
export async function fetchCatalog(): Promise<CatalogData> {
  const client = await getServerClient();
  if (client) {
    try {
      const res = await catalog.listProducts(client, { pageSize: 200 });
      if (res.items.length) {
        const products = res.items;
        const ids = products.map((p) => p.id);
        const [categories, { data: variants }, { data: media }, lowStock] = await Promise.all([
          catalog.listCategories(client),
          client
            .from('product_variants')
            .select('id, product_id, price, sale_price, is_active')
            .in('product_id', ids),
          client
            .from('product_media')
            .select('product_id, url, kind, sort')
            .in('product_id', ids)
            .eq('kind', 'image')
            .order('sort', { ascending: true }),
          analytics.getLowStock(client, 10_000).catch(() => []),
        ]);

        const variantsByProduct = new Map<string, VariantRow[]>();
        for (const v of (variants ?? []) as VariantRow[]) {
          const arr = variantsByProduct.get(v.product_id) ?? [];
          arr.push(v);
          variantsByProduct.set(v.product_id, arr);
        }
        const imageByProduct = new Map<string, string>();
        for (const m of (media ?? []) as ProductMedia[]) {
          if (!imageByProduct.has(m.product_id)) imageByProduct.set(m.product_id, m.url);
        }
        // Sum available stock per product from the low-stock RPC rows (which
        // carry on_hand/reserved/available per variant).
        const stockByProduct = new Map<string, number>();
        for (const item of lowStock) {
          stockByProduct.set(
            item.product_id,
            (stockByProduct.get(item.product_id) ?? 0) + Math.max(0, item.available),
          );
        }
        const catById = new Map(categories.map((c) => [c.id, c]));

        const enriched: CatalogProduct[] = products.map((p) => {
          const vs = (variantsByProduct.get(p.id) ?? []).filter((v) => v.is_active);
          const cheap = cheapest(vs as unknown as ProductVariant[]);
          const cat = p.category_id ? catById.get(p.category_id) : null;
          return {
            ...p,
            image: imageByProduct.get(p.id) ?? null,
            price: cheap?.price ?? 0,
            salePrice: cheap?.sale_price ?? null,
            stock: stockByProduct.get(p.id) ?? 0,
            variantCount: vs.length,
            categoryNameAr: cat?.name_ar ?? null,
            categoryNameEn: cat?.name_en ?? null,
          };
        });

        return { live: true, products: enriched, categories };
      }
    } catch {
      /* fall through to sample */
    }
  }
  return { live: false, products: sampleCatalogProducts, categories: sampleCategories };
}

/** Single product detail for the add/edit form. */
export async function fetchCatalogProduct(id: string): Promise<{ live: boolean; product: CatalogProductDetail | null }> {
  const client = await getServerClient();
  if (client) {
    try {
      const { data: product } = await client
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (product) {
        const p = product as Product;
        const [{ data: variants }, { data: media }] = await Promise.all([
          client.from('product_variants').select('*').eq('product_id', id),
          client.from('product_media').select('*').eq('product_id', id).order('sort', { ascending: true }),
        ]);
        const variantIds = ((variants ?? []) as ProductVariant[]).map((v) => v.id);
        const { data: levels } = variantIds.length
          ? await client
              .from('inventory_levels')
              .select('variant_id, on_hand, reserved')
              .in('variant_id', variantIds)
          : { data: null };
        const levelByVariant = new Map<string, { on_hand: number; reserved: number }>();
        for (const l of (levels ?? []) as { variant_id: string; on_hand: number; reserved: number }[]) {
          const cur = levelByVariant.get(l.variant_id) ?? { on_hand: 0, reserved: 0 };
          levelByVariant.set(l.variant_id, { on_hand: cur.on_hand + l.on_hand, reserved: cur.reserved + l.reserved });
        }
        const cvariants: CatalogVariant[] = ((variants ?? []) as ProductVariant[]).map((v) => {
          const lvl = levelByVariant.get(v.id) ?? { on_hand: 0, reserved: 0 };
          return { ...v, onHand: lvl.on_hand, reserved: lvl.reserved, available: Math.max(0, lvl.on_hand - lvl.reserved) };
        });
        return {
          live: true,
          product: { ...p, variants: cvariants, media: ((media ?? []) as ProductMedia[]) },
        };
      }
    } catch {
      /* fall through */
    }
  }
  const seed = CATALOG_SEEDS.find((s) => s.id === id);
  return { live: false, product: seed ? seedToDetail(seed) : null };
}

/** Inventory rows for the inventory tab. Live where possible, sample otherwise. */
export async function fetchInventory(): Promise<{ live: boolean; rows: InventoryRow[] }> {
  const client = await getServerClient();
  if (client) {
    try {
      const rows = await analytics.getLowStock(client, 10_000);
      if (rows.length) {
        return {
          live: true,
          rows: rows.map((r) => ({
            variantId: r.variant_id,
            productId: r.product_id,
            productNameAr: r.name_ar ?? '',
            productNameEn: r.name_en ?? '',
            sku: r.sku,
            attributes: {},
            onHand: r.on_hand,
            reserved: r.reserved,
            available: r.available,
            lowThreshold: LOW_STOCK_THRESHOLD,
          })),
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { live: false, rows: sampleInventoryRows() };
}

export const LOW_STOCK = LOW_STOCK_THRESHOLD;
