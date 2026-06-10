/**
 * Resolve a variant id to a human display name. In demo mode the sample
 * catalog gives a real product name; with a live backend the cart screen only
 * has variant ids (no joined product), so we fall back to the SKU-ish id —
 * the order snapshot carries the real name once checked out.
 */
import { hasLiveBackend } from './env';
import { SAMPLE_PRODUCTS, sampleVariants } from './sampleData';

export function variantDisplayName(variantId: string): string {
  if (!hasLiveBackend) {
    for (const p of SAMPLE_PRODUCTS) {
      const match = sampleVariants(p.id).find((v) => v.id === variantId);
      if (match) {
        const attrs = Object.values(match.attributes).join(' · ');
        return attrs ? `${p.name_en} — ${attrs}` : p.name_en;
      }
    }
  }
  return variantId;
}
