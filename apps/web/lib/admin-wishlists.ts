import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WishlistedProduct {
  productId: string;
  nameAr: string;
  nameEn: string;
  wishlistCount: number;
  /** Minimum price across active variants (KWD numeric(10,3)) */
  minPrice: number | null;
  /** Total on-hand stock across all variants and locations */
  totalStock: number | null;
}

export interface RecentWishlistItem {
  productId: string;
  nameAr: string;
  nameEn: string;
  customerName: string;
  addedAt: string;
}

export interface WishlistInsights {
  live: boolean;
  totalItems: number;
  distinctCustomers: number;
  topProducts: WishlistedProduct[];
  recentItems: RecentWishlistItem[];
}

// ── Sample fallback ────────────────────────────────────────────────────────

const SAMPLE_TOP: WishlistedProduct[] = [
  {
    productId: 'p-1',
    nameAr: 'تلفزيون سامسونج QLED 4K',
    nameEn: 'Samsung 65" QLED 4K Smart TV',
    wishlistCount: 47,
    minPrice: 249.000,
    totalStock: 12,
  },
  {
    productId: 'p-2',
    nameAr: 'مكيف سبليت إل جي 18000 وحدة',
    nameEn: 'LG Split AC 18,000 BTU Inverter',
    wishlistCount: 34,
    minPrice: 199.000,
    totalStock: 5,
  },
  {
    productId: 'p-7',
    nameAr: 'ثلاجة إل جي 4 أبواب',
    nameEn: 'LG French-Door Refrigerator',
    wishlistCount: 28,
    minPrice: 389.000,
    totalStock: 0,
  },
];

const SAMPLE_RECENT: RecentWishlistItem[] = [
  {
    productId: 'p-1',
    nameAr: 'تلفزيون سامسونج QLED 4K',
    nameEn: 'Samsung 65" QLED 4K Smart TV',
    customerName: 'فهد العنزي',
    addedAt: new Date().toISOString(),
  },
  {
    productId: 'p-3',
    nameAr: 'غسالة بوش 9 كجم',
    nameEn: 'Bosch 9kg Front-Load Washer',
    customerName: 'نورة الشمري',
    addedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

// ── Raw row shapes (cast targets) ──────────────────────────────────────────

interface WishlistAllRow {
  product_id: string;
  user_id: string;
  products: {
    name_ar: string;
    name_en: string;
    product_variants: {
      price: number;
      sale_price: number | null;
      is_active: boolean;
      inventory: { on_hand: number }[];
    }[];
  } | null;
}

interface RecentRow {
  product_id: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
  products: { name_ar: string; name_en: string } | null;
}

// ── Seam ───────────────────────────────────────────────────────────────────

export async function fetchWishlistInsights(): Promise<WishlistInsights> {
  const sb = await getServerClient();

  if (!sb) {
    return {
      live: false,
      totalItems: 109,
      distinctCustomers: 42,
      topProducts: SAMPLE_TOP,
      recentItems: SAMPLE_RECENT,
    };
  }

  const [{ data: allRows }, { data: recentRows }] = await Promise.all([
    sb
      .from('wishlist_items')
      .select(
        `product_id, user_id,
         products(
           name_ar, name_en,
           product_variants(price, sale_price, is_active, inventory(on_hand))
         )`,
      )
      .order('product_id'),
    sb
      .from('wishlist_items')
      .select(
        `product_id, created_at,
         profiles(full_name),
         products(name_ar, name_en)`,
      )
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!allRows) {
    return {
      live: false,
      totalItems: 0,
      distinctCustomers: 0,
      topProducts: SAMPLE_TOP,
      recentItems: SAMPLE_RECENT,
    };
  }

  const rows = allRows as unknown as WishlistAllRow[];

  // Aggregate counts per product, collect distinct customers
  const countMap = new Map<string, { count: number; products: WishlistAllRow['products'] }>();
  const userSet = new Set<string>();

  for (const r of rows) {
    userSet.add(r.user_id);
    const existing = countMap.get(r.product_id);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(r.product_id, { count: 1, products: r.products });
    }
  }

  // Sort by count desc, take top 20
  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20);

  const topProducts: WishlistedProduct[] = sorted.map(([productId, { count, products: p }]) => {
    const variants = p?.product_variants ?? [];
    const activeVariants = variants.filter((v) => v.is_active);
    const prices = activeVariants
      .map((v) => v.sale_price ?? v.price)
      .filter((x): x is number => x != null);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const totalStock = activeVariants.reduce(
      (sum, v) => sum + (v.inventory ?? []).reduce((s, i) => s + (i.on_hand ?? 0), 0),
      0,
    );

    return {
      productId,
      nameAr: p?.name_ar ?? '—',
      nameEn: p?.name_en ?? '—',
      wishlistCount: count,
      minPrice,
      totalStock: variants.length > 0 ? totalStock : null,
    };
  });

  const recent = recentRows as unknown as RecentRow[] | null;
  const recentItems: RecentWishlistItem[] = (recent ?? []).map((r) => ({
    productId: r.product_id,
    nameAr: r.products?.name_ar ?? '—',
    nameEn: r.products?.name_en ?? '—',
    customerName: r.profiles?.full_name ?? 'مجهول',
    addedAt: r.created_at,
  }));

  return {
    live: true,
    totalItems: rows.length,
    distinctCustomers: userSet.size,
    topProducts,
    recentItems,
  };
}
