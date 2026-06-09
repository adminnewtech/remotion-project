/**
 * Catalog reads — categories, products, product detail, search.
 * RLS exposes only active rows to customers; ops/admins see all.
 */
import type {
  Category,
  Product,
  ProductMedia,
  ProductVariant,
  ProductWithVariants,
} from '@elite/types';
import type { EliteClient } from './client';

const DEFAULT_PAGE_SIZE = 20;

export interface ListProductsParams {
  categoryId?: string;
  search?: string;
  brand?: string;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** List active categories, ordered for menu display. */
export async function listCategories(client: EliteClient): Promise<Category[]> {
  const { data, error } = await client
    .from('categories')
    .select('*')
    .order('sort', { ascending: true })
    .order('name_en', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

/**
 * List products with optional filtering (category / brand / free-text) and
 * pagination. Free-text uses the `search_tsv` full-text column.
 */
export async function listProducts(
  client: EliteClient,
  params: ListProductsParams = {},
): Promise<Paginated<Product>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  if (params.categoryId) query = query.eq('category_id', params.categoryId);
  if (params.brand) query = query.eq('brand', params.brand);
  if (params.search && params.search.trim()) {
    query = query.textSearch('search_tsv', params.search.trim(), {
      type: 'websearch',
      config: 'simple',
    });
  }

  const { data, error, count } = await query
    .order('name_en', { ascending: true })
    .range(from, to);
  if (error) throw error;

  return {
    items: (data ?? []) as Product[],
    page,
    pageSize,
    total: count ?? 0,
  };
}

/**
 * Fetch a single product by slug with its variants, media and category.
 * Returns `null` if not found / not visible to the caller.
 */
export async function getProduct(
  client: EliteClient,
  slug: string,
): Promise<ProductWithVariants | null> {
  const { data: product, error } = await client
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;

  const productId = (product as Product).id;
  const [{ data: variants, error: vErr }, { data: media, error: mErr }, category] =
    await Promise.all([
      client
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true),
      client
        .from('product_media')
        .select('*')
        .eq('product_id', productId)
        .order('sort', { ascending: true }),
      resolveCategory(client, (product as Product).category_id),
    ]);
  if (vErr) throw vErr;
  if (mErr) throw mErr;

  return {
    ...(product as Product),
    variants: (variants ?? []) as ProductVariant[],
    media: (media ?? []) as ProductMedia[],
    category,
  };
}

async function resolveCategory(
  client: EliteClient,
  categoryId: string | null,
): Promise<Category | null> {
  if (!categoryId) return null;
  const { data, error } = await client
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .maybeSingle();
  if (error) throw error;
  return (data as Category | null) ?? null;
}

/**
 * Trigram / full-text search across product name, brand and description.
 * Backed by the `search_tsv` GIN index and `pg_trgm` name indexes.
 */
export async function searchProducts(client: EliteClient, q: string): Promise<Product[]> {
  const term = q.trim();
  if (!term) return [];
  const { data, error } = await client
    .from('products')
    .select('*')
    .eq('is_active', true)
    .textSearch('search_tsv', term, { type: 'websearch', config: 'simple' })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Product[];
}
