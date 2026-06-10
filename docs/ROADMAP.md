# Elite v1 — Roadmap

> **Now live:** web storefront + admin on Vercel
> (https://remotion-project-6dvr.vercel.app), Supabase project `elite-v1`
> provisioned with schema/RLS and a seeded catalog. See `STATUS.md` for the
> live snapshot.

## Phase 0 — Foundation ✅ done
- Monorepo (pnpm + Turborepo), shared `types`, `core`, `ui`, `i18n`, `config` packages.
- Full Supabase schema + RLS as migrations (the contract).
- App scaffolds: Next.js web (storefront + admin), Expo mobile (customer/driver/technician).
- Integration adapter stubs (Zoho Books, Zoho Desk, Gmail, Meta Ads, Cloudflare).
- Docs: architecture, data model, features, roadmap. `.env.example`.

## Phase 1 — Vertical slice (provision + first real flow) 🟢 mostly live
- ✅ Provisioned Supabase project + Vercel; loaded migrations `0001`–`0008`.
- ✅ Seeded catalog from newtechq8.com (4 categories, 24 products, 30 variants).
- ✅ Auth (phone OTP) live.
- ✅ Customer: browse → product detail → cart → checkout (KNET sandbox) → order created.
- ✅ Admin: see orders live, manage catalog/inventory.
- 🟡 Notifications: order confirmation (push + email) — wiring in progress.

### Remaining to fully close Phase 1 (go-live)
1. **Custom domain** — connect `newtechq8.com` (or a subdomain) to the Vercel
   project; issue TLS; set canonical URLs + SEO metadata.
2. **Full catalog sync** — promote the seed slice to the complete Shopify
   catalog (re-run `scripts/sync-shopify-catalog.ts` / admin "Catalog" screen);
   schedule incremental syncs.
3. **Payments go-live** — swap KNET sandbox for production gateway keys
   (MyFatoorah/Tap), configure webhooks + reconciliation, enable COD fee.
4. **Mobile EAS builds** — `eas build` preview/production for the customer,
   driver, and technician apps; internal distribution + store submission prep.
5. **Cloudflare** — put DNS/CDN/WAF in front of the domain (caching rules, rate
   limiting, bot protection) once the custom domain is connected.

## Phase 2 — Logistics & field service
- Dispatch Edge Function (auto-assign by zone + manual override).
- Driver app: task queue, live GPS, proof of delivery → customer live map.
- Technician app: installation job flow, checklist, before/after photos, sign-off.
- Real-time order/delivery/installation tracking for customers.

## Phase 3 — Support, warranty & finance
- In-app support chat + warranty claims, synced to Zoho Desk.
- Digital warranty cards; warranty → repair/installation job.
- Zoho Books sync: invoices, payments, expenses.

## Phase 4 — Growth & intelligence
- Meta Ads: catalog feed + campaign/audience automation from admin.
- Loyalty, referrals, wishlist, reviews surfacing.
- AI layer: recommendations, support copilot, demand forecasting, smart dispatch.
- Production hardening: load testing, observability, EAS production builds, store submission.

## Cross-cutting (every phase)
- RLS coverage + security review before each provisioning step.
- Arabic/English parity and RTL QA.
- Analytics dashboards kept in sync with new modules.

## Provisioning checklist (go-live)
1. ✅ Create Supabase project → set keys in `.env.local` / Vercel / EAS.
2. ✅ `pnpm db:push` migrations; run `db:seed`.
3. ✅ Deploy web to Vercel (live at https://remotion-project-6dvr.vercel.app).
4. 🟡 Configure payment gateway (MyFatoorah/Tap) production keys + webhooks.
5. 🔴 Connect custom domain + Cloudflare (DNS/CDN/WAF).
6. 🔴 Full catalog sync from Shopify (beyond the seed slice).
7. 🔴 Build mobile with EAS; smoke-test the full vertical slice.
8. 🟡 Connect Zoho Books, Zoho Desk, Gmail, Meta Ads credentials.
