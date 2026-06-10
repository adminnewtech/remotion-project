import type { Product } from '@elite/types';

/**
 * Display extras a catalog card needs that don't live on the bare `Product`
 * row: the primary image and the effective price (cheapest active variant).
 * Computed server-side from `product_variants` + `product_media` so live
 * products render correctly (price/image), independent of sample meta.
 */
export interface ProductDisplay {
  image: string | null;
  price: number;
  salePrice: number | null;
  rating?: number;
  reviews?: number;
}

/** A product paired with its resolved display extras. */
export interface ProductWithDisplay {
  product: Product;
  display: ProductDisplay;
}
