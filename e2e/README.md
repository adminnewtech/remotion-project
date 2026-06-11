# Elite v1 — E2E Test Suite (`@elite/e2e`)

End-to-end Playwright tests + a manual QA plan for the **Elite v1** storefront
(Newtech, Kuwait electronics). The storefront is Arabic-first and RTL, serves
`/ar` and `/en` locales, and reads a live Supabase catalog (~72 products across
10 categories).

> These tests run against a **deployed** URL (no local server is started).
> They exercise read paths and the client-side cart/checkout up to — but not
> including — placing a real order/payment. No login is required; login-gated
> steps are skipped or soft-asserted.

## Prerequisites

- Node.js 18+ and npm.
- Network access to the target deploy and its Supabase backend.

## Install

```bash
cd e2e
npm install
npx playwright install --with-deps   # or: npm run install:browsers
```

## Run

```bash
# Against the default (live production) URL:
npx playwright test

# Against a preview / staging deploy:
BASE_URL=https://your-preview.vercel.app npx playwright test

# Only one viewport:
npx playwright test --project=desktop-chromium
npx playwright test --project=mobile-safari

# Single spec / interactive:
npx playwright test tests/cart.spec.ts
npx playwright test --ui
```

`BASE_URL` defaults to `https://remotion-project-6dvr.vercel.app` (set in
`playwright.config.ts`). It is trailing-slash tolerant. Do **not** put secrets
here — the suite never authenticates.

## View the report

```bash
npx playwright show-report      # or: npm run report
```

## What the specs cover

| Spec | Covers |
| --- | --- |
| `tests/home.spec.ts` | Home loads in ar + en, header/nav, brand link, language switch (ar↔en) flips `<html dir>`, bare-root render |
| `tests/catalog.spec.ts` | Category grids render, cards show KWD price + image w/ alt, card → PDP, unknown-slug not-found |
| `tests/product-detail.spec.ts` | PDP title/price/gallery, add-to-cart, Buy+Install toggle, variant selector |
| `tests/search-filters.spec.ts` | Search box submit, results, brand / price / needs-installation filters, category nav |
| `tests/cart.spec.ts` | Add, qty +/−, remove, order-summary totals, free-delivery threshold (10 KWD), checkout link |
| `tests/checkout.spec.ts` | Stepper address → delivery slot → (installation) → payment; KNET + COD options visible (stops before placing order) |
| `tests/auth-account.spec.ts` | Login (phone/OTP) form renders, account/support pages render, `/admin` is gated |
| `tests/seo.spec.ts` | `<title>`, meta description, hreflang ar+en, canonical, Product + Breadcrumb JSON-LD with KWD offer, OG tags |
| `tests/a11y-console.spec.ts` | Alt text, labelled controls, single `<h1>`, no unexpected console errors on key pages |
| `tests/helpers.ts` | Shared helpers (locale nav, KWD regex, JSON-LD reader, console tracker) — not a spec |

Selectors are role/text-based and tolerate either locale; steps that need a
real backend value (e.g. multi-variant products, a price slider) self-skip when
the live catalog doesn't provide them.

---

## Manual QA checklist

Run before each release. Test both **/ar (RTL)** and **/en (LTR)**, on desktop
**and** mobile, and on Safari/iOS + Chrome/Android.

### Customer (storefront)
- [ ] Home loads; hero, trust strip, categories and featured products render.
- [ ] Language switch (ع / EN) swaps locale, persists (`NEXT_LOCALE` cookie), and flips direction.
- [ ] Category pages list correct products; prices in KWD (3 decimals), images load, sale badges correct.
- [ ] Search returns relevant results; brand / price / needs-installation filters and sort work.
- [ ] PDP: gallery thumbnails switch image; variant selector updates price/SKU; in/out-of-stock state correct.
- [ ] Buy + Install toggle adds the installation fee and surfaces in cart/summary.
- [ ] Cart: add / update qty / remove; subtotal, delivery, installation, discount and total are correct.
- [ ] Free-delivery threshold: below 10 KWD shows "spend X more"; at/above shows free delivery.
- [ ] Checkout: address validation, delivery slot, installation slot (when applicable), payment selection.
- [ ] Promo code field accepts/rejects codes as expected.
- [ ] Account: login via phone OTP (+965), order history, order detail + live status timeline.
- [ ] Support: open a ticket / chat from account; receive replies.

### Payments
- [ ] **KNET**: redirect to gateway, success returns to confirmation, order marked paid.
- [ ] **KNET failure/cancel**: user returned with a clear error, no order created (or order left pending).
- [ ] **Apple Pay / Google Pay / card**: sheet appears, success + failure paths.
- [ ] **COD (cash on delivery)**: order placed without redirect; flagged as COD for the driver.
- [ ] Payment webhook reconciles order status (check `payment-webhook` edge function logs).
- [ ] Refund / cancellation path updates order + finance records.

### Admin (back office)
- [ ] `/admin` blocked for guests/customers; redirects to login (`?next=admin`).
- [ ] Admin/employee can sign in and see dashboard, catalog, orders, dispatch, finance, staff, support, marketing.
- [ ] Catalog manager: create/edit product, variants, price, stock, installation flag.
- [ ] Orders: view, change status, assign driver/technician.
- [ ] Dispatch: assign and reassign jobs; map/queue updates.
- [ ] Finance: totals reconcile with orders/payments.
- [ ] RLS enforced: a customer token cannot read/write admin data via the API.

### Driver
- [ ] Driver app login; sees assigned deliveries with address + slot.
- [ ] Update delivery status (en route / delivered / failed); customer sees live tracking.
- [ ] COD collection recorded.
- [ ] Push/SMS notification on new assignment.

### Technician (installation)
- [ ] Technician login; sees installation jobs with product + slot + address.
- [ ] Start / complete installation; status flows back to order + customer.
- [ ] Notification on new installation assignment.

### Notifications
- [ ] OTP SMS delivered on login.
- [ ] Order confirmation (and status changes) via SMS/push/email.
- [ ] Driver/technician assignment notifications.
- [ ] `notify` edge function logs show no failures.

### RTL / i18n
- [ ] `<html dir="rtl">` on /ar, `ltr` on /en.
- [ ] Logical spacing/icons mirror correctly (no clipped or overlapping UI in RTL).
- [ ] Arabic numerals/currency render correctly; dates localized (ar-KW / en-GB).
- [ ] No untranslated keys (e.g. `catalog.title` showing as a raw key).
- [ ] Mixed-direction content (phone `+965`, prices) stays LTR where required.

### Performance & resilience
- [ ] Lighthouse mobile: LCP < 2.5s, CLS < 0.1, TBT reasonable on home + PDP.
- [ ] Images use `next/image` (sized, lazy below the fold); no layout shift.
- [ ] Catalog/category pages cache/ISR sensibly; no N+1 to Supabase.
- [ ] Graceful behavior when Supabase is slow/unavailable (no white screen).
- [ ] No console errors/warnings on key pages (covered by `a11y-console.spec.ts`).
- [ ] 404/empty-cart/empty-search states render cleanly.

### SEO
- [ ] Unique `<title>` + meta description per page; canonical correct.
- [ ] hreflang ar/en alternates on home, category, product, search.
- [ ] Product JSON-LD valid (KWD offer, availability, brand, aggregateRating) — validate via Google Rich Results test.
- [ ] `sitemap.xml` and `robots.txt` present and correct; non-canonical search (`?q=`) noindexed.
