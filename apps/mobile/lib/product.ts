/**
 * Pure helpers for deriving display data from catalog rows. For list screens
 * we only have `Product` rows (no variants), so when the backend is absent we
 * pull pricing/media from the sample module; with a live backend the product
 * detail call hydrates variants. This keeps list tiles cheap.
 */
import type { Product, ProductVariant } from '@elite/types';
import { hasLiveBackend } from './env';
import { sampleVariants, sampleMedia } from './sampleData';

export interface DisplayPrice {
  price: number;
  compareAt: number | null;
}

/** Lowest effective price across variants (sale_price wins per variant). */
export function lowestPrice(variants: ProductVariant[]): DisplayPrice {
  if (variants.length === 0) return { price: 0, compareAt: null };
  let best = variants[0]!;
  let bestEff = best.sale_price ?? best.price;
  for (const v of variants) {
    const eff = v.sale_price ?? v.price;
    if (eff < bestEff) {
      best = v;
      bestEff = eff;
    }
  }
  return {
    price: bestEff,
    compareAt: best.sale_price != null ? best.price : null,
  };
}

/**
 * Best-effort price + image for a list tile. With a live backend we don't have
 * variants in the list payload, so we render price 0 (the detail screen shows
 * the real price) — but in demo/sample mode we resolve from the sample module
 * so the storefront looks complete.
 */
export function tileDisplay(product: Product): { price: number; compareAt: number | null; image: string | null } {
  if (!hasLiveBackend) {
    const dp = lowestPrice(sampleVariants(product.id));
    const media = sampleMedia(product.id);
    return { price: dp.price, compareAt: dp.compareAt, image: media[0]?.url ?? null };
  }
  return { price: 0, compareAt: null, image: null };
}
