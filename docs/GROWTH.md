# Growth / Launch Layer — Newtech OS

The acquisition + conversion surface on top of Elite v1: product feeds for paid
+ organic acquisition, an offers/promo surface, a brand index, and a Core Web
Vitals pass. All built Arabic-first against the live Supabase catalog through the
`lib/feeds.ts` seam (sample fallback when env is absent, so builds never break).

---

## Product feeds

Both feeds emit **every active product**, Arabic-first, with effective
(sale-aware) prices in **KWD (3 decimals)** and live-inventory availability.
They share one resolver: `apps/web/lib/feeds.ts → fetchCatalogItems()` (two
batched queries for variants + media, one for inventory — no N+1). Revalidate
hourly (`revalidate = 3600`).

| Feed | URL | Format |
|---|---|---|
| Google Merchant | `https://remotion-project-6dvr.vercel.app/feeds/google-merchant.xml` | RSS 2.0 + `g:` namespace |
| Meta catalog | `https://remotion-project-6dvr.vercel.app/feeds/meta-catalog.csv` | CSV, UTF-8 + BOM |

### Sample item shape

**Google Merchant (`<item>`):**

```xml
<item>
  <g:id>SAM-001</g:id>
  <g:title>تلفزيون سامسونج QLED 4K مقاس 65 بوصة</g:title>
  <g:description>شاشة QLED بدقة 4K مع تركيب احترافي وضمان…</g:description>
  <g:link>https://remotion-project-6dvr.vercel.app/ar/product/samsung-65-qled-4k</g:link>
  <link>https://remotion-project-6dvr.vercel.app/ar/product/samsung-65-qled-4k</link>
  <g:image_link>https://…/image.jpg</g:image_link>
  <g:price>249.000 KWD</g:price>
  <g:availability>in_stock</g:availability>
  <g:condition>new</g:condition>
  <g:brand>Samsung</g:brand>
  <g:identifier_exists>no</g:identifier_exists>
</item>
```

- `g:id` = variant SKU when present, else product id.
- `g:identifier_exists` = `no` when no GTIN/barcode is known (else `yes` + `g:gtin`).
- `g:availability` = `in_stock` unless live inventory reports zero on-hand
  (unknown inventory defaults to `in_stock` — never wrongly suppress a listing).

**Meta catalog (CSV header + row):**

```
id,title,description,availability,condition,price,link,image_link,brand
"SAM-001","تلفزيون سامسونج QLED 4K مقاس 65 بوصة","شاشة QLED…","in_stock","new","249.000 KWD","https://remotion-project-6dvr.vercel.app/ar/product/samsung-65-qled-4k","https://…/image.jpg","Samsung"
```

- Served as `text/csv; charset=utf-8` with a leading **UTF-8 BOM** and `\r\n`
  line endings so Arabic renders correctly when opened in Excel.

### Submit to Google Merchant Center

1. Merchant Center → **Products → Feeds → +** (Add primary feed).
2. Country **Kuwait**, language **Arabic (ar)**.
3. Method: **Scheduled fetch**. Paste the Google Merchant URL above.
4. Set a daily fetch time; save. Review the **Diagnostics** tab for any
   disapprovals (GTIN warnings are expected — we send `identifier_exists: no`).
5. Link Merchant Center to Google Ads for Performance Max / Shopping campaigns.

### Submit to Meta Commerce Manager

1. Commerce Manager → **Catalog → Data sources → Add items → Use a URL**.
2. Paste the Meta catalog CSV URL above; set schedule to **Hourly/Daily**.
3. Map columns (auto-detected: `id, title, description, availability,
   condition, price, link, image_link, brand`).
4. Once items ingest, build **product sets** for dynamic ads / Advantage+ catalog
   retargeting; connect the catalog to the Pixel/dataset for DPA.

---

## Pages

| Page | Route | Notes |
|---|---|---|
| Offers | `/{locale}/offers` | On-sale products (sale < list) + any offers/bundles-category products, copyable **NEWTECH10** coupon hero, reuses `ProductGrid`/`ProductCard`. ISR 300s. |
| Brands | `/{locale}/brands` | Distinct brands + live product counts → filtered `search?q=`. Premium initials cards. ISR 300s. |

Both are linked from the header category bar (Offers highlighted in accent).

## Promo strategy notes

- **NEWTECH10** — 10% off first order. Surfaced as a click-to-copy coupon card
  (matches the homepage OffersBanner gradient). Pair with the Meta/Google feeds:
  use the same code in ad creative to attribute paid → first purchase.
- Offers page is the landing target for Shopping / Advantage+ traffic; keep the
  sale set fresh (variant `sale_price < price`) so the feed and page stay in sync.
- Bundles (product + installation + warranty) raise AOV — surface any
  offers/bundles category here automatically (slug heuristic in `offers/page.tsx`).
- Free-delivery threshold (10 KWD, per TrustBar) reinforces the coupon at checkout.

---

## Core Web Vitals checklist (targets: LCP < 2.0s, INP < 200ms, CLS < 0.1)

| Item | Status | What was done |
|---|---|---|
| Arabic font subsetting | ✅ | `next/font/google` Cairo `subsets: ['arabic','latin']`, `display: 'swap'`, CSS-variable wired in `app/[locale]/layout.tsx`. No CSS `@import` — fonts self-hosted by Next, subset + swap (no FOIT, lower INP on Arabic). Inter for Latin UI. |
| `sizes` on `next/image fill` | ✅ | Audited all owned storefront pages/components (`product-card`, `home/*`, offers, brands, category, search). Every `fill` image has an explicit responsive `sizes`; no raw `<img>` tags. |
| CLS from images | ✅ | Cards use a fixed `aspect-square` container + skeleton shimmer until paint — space reserved, no layout shift. |
| LCP image priority | ✅ | First above-the-fold rail/hero image marked `priority`; below-the-fold lazy-loaded. |
| ISR on heavy listings | ✅ | `revalidate = 300` added to `category/[slug]`, `search`, `offers`, `brands`; feeds `revalidate = 3600`. Cuts TTFB on repeat traffic. |
| INP / client JS weight | ✅ | Listing/offers/brands pages are Server Components; only the coupon card and the filter grid are client islands. No oversized first-load client bundles added. |
| Feed cache headers | ✅ | `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on both feeds. |

### Still recommended (outside this layer's scope)
- Run Lighthouse / PageSpeed against the live deploy to confirm field LCP/INP.
- Cloudflare in front for Kuwait edge caching (MASTER_PLAN P1).
