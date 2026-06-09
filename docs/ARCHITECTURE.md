# Elite v1 — Architecture

## 1. Goals & principles

Elite v1 is a **super-app** for Newtech that beats the experience of Keeta / Talabat / AliExpress for a focused vertical: **electronics commerce + professional installation + delivery**, all in one platform, in Arabic-first (RTL) with English.

Guiding principles:

1. **One source of truth.** Supabase Postgres is the system of record. Everything (catalog, orders, logistics, scheduling, support) lives in one relational model with strong foreign keys.
2. **Type-safe end to end.** A single `packages/types` package is the contract. DB types are generated from the schema; domain types extend them. Web and mobile import the same types.
3. **Realtime by default.** Order status, driver GPS, technician job state, and chat all flow over Supabase Realtime channels.
4. **Secure by construction.** Row Level Security (RLS) enforces role boundaries in the database, not just the UI. A customer can never read another customer's orders even if the client is compromised.
5. **Offline-tolerant field apps.** Driver and technician apps queue actions (proof of delivery, job completion) and sync when connectivity returns.
6. **Integrations are adapters, not couplings.** Zoho, Gmail, Meta, Cloudflare sit behind interfaces in `packages/core/integrations` so they can be swapped or stubbed.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Shared code web↔mobile, cached task graph |
| Language | TypeScript (strict) | One language across the stack |
| Backend | Supabase (Postgres 15, Auth, Realtime, Storage, Edge Functions) | Managed Postgres + auth + realtime + serverless, no ops |
| Web | Next.js 15 (App Router, RSC) | SEO storefront + fast admin dashboard, Vercel-native |
| Mobile | Expo (React Native, expo-router) | iOS + Android from shared React/TS, OTA updates |
| Styling (web) | Tailwind CSS + shadcn/ui | Fast, consistent, RTL plugin |
| Styling (mobile) | Shared design tokens + RN primitives | Same tokens as web |
| State/data | TanStack Query + Supabase client | Cache, optimistic updates, realtime sync |
| Maps | Google Maps / Mapbox (driver & technician tracking) | Live GPS, routing |
| Payments | KNET + Apple Pay / Google Pay via gateway (MyFatoorah / Tap) | Kuwait-market payment rails |
| Hosting | Vercel (web), EAS (mobile builds) | Push-to-deploy |
| Edge/CDN | Cloudflare (image resizing, WAF, caching) | Fast asset delivery in GCC |

## 3. Module map

```
Identity & Roles ─► Commerce ─► Checkout & Payments ─► Fulfillment ─┬─► Delivery (drivers)
                                                                     └─► Installation (technicians)
        │                                                                        │
        └────────────► Support & Warranty ◄──────────────────────────────────────┘
                                │
        Analytics & Admin ◄─────┴─────► Notifications ─► Marketing (Meta Ads)
                                                  │
                              Accounting (Zoho Books)   Support desk (Zoho Desk)
```

### 3.1 Identity & Roles
Supabase Auth (phone OTP — primary in Kuwait — + email). A `profiles` row per user with a `role` enum: `customer | employee | technician | driver | admin`. RLS policies key off `auth.uid()` and the user's role. Admins assign roles; staff (employee/technician/driver) are invited.

### 3.2 Commerce (custom, on Supabase)
Categories → Products → Variants (with attributes like color/model) → Inventory by warehouse/location. Rich media in Supabase Storage (served via Cloudflare). Pricing in KWD with optional sale prices, bundles, and "requires installation" flags. Search & filtering via Postgres full-text + `pg_trgm`.

### 3.3 Checkout & Payments
Cart → address (with Kuwait area/block/street model) → delivery slot and/or installation slot → payment. An Edge Function `checkout` validates inventory, computes totals (delivery fee, free-delivery threshold 10 KWD, installation fee), reserves stock atomically, creates the order, and initiates payment with the gateway. Webhooks confirm payment.

### 3.4 Fulfillment, Delivery & Installation
An order produces one or more **fulfillment tasks**:
- **Delivery task** → assigned to a driver, live GPS tracking, proof of delivery (photo + signature/OTP).
- **Installation job** → assigned to a technician, scheduled 1–4 days out, checklist + before/after photos + customer sign-off.
Dispatch logic (auto-assign by zone/availability + manual override in admin) runs in Edge Functions and writes to realtime channels.

### 3.5 Support & Warranty
1-year warranty tracked per order line. Customers open tickets in-app; tickets sync to **Zoho Desk**. Threaded chat over Realtime. Warranty claims can spawn an installation/repair job.

### 3.6 Analytics & Admin
Admin dashboard: sales, AOV, conversion, inventory health, driver/technician utilization, SLA on delivery & installation, support metrics. Backed by SQL views and (optionally) materialized views.

### 3.7 Notifications
Unified service: push (Expo push for mobile, web push), in-app, email (Gmail), SMS for OTP/delivery. Triggered by DB events (Postgres triggers → Edge Function) for order/delivery/installation milestones.

### 3.8 Integrations (adapters in `packages/core/integrations`)
- **Zoho Books** — invoices, payments, expenses, financial sync.
- **Zoho Desk** — support ticket backbone.
- **Gmail** — transactional + marketing email.
- **Meta Ads** — product catalog feed + campaign/audience automation.
- **Cloudflare** — image optimization, WAF, edge caching.

## 4. Data flow examples

**Place an order (customer, mobile):**
`Cart → checkout Edge Fn (validate + reserve + create order + init payment) → gateway → payment webhook → order.paid → trigger → notification + Zoho invoice → dispatch Edge Fn creates delivery/installation tasks → realtime to admin & field apps.`

**Driver delivering (realtime):**
`Driver app streams GPS → driver_locations table → Realtime → customer sees live map. On delivery: POD photo to Storage + status=delivered → trigger → customer notification + order closeout.`

## 5. Security model

- **RLS everywhere.** Every table has policies. Customers: own rows only. Drivers/technicians: only tasks assigned to them. Employees/admins: scoped by role via a `has_role()` SQL helper.
- **No service-role key on clients.** Privileged operations (dispatch, refunds, payouts) run only in Edge Functions with the service role.
- **Audit log.** `audit_events` records sensitive mutations (role changes, refunds, price edits).
- **Secrets** live in Supabase/Vercel env, never in the repo. `.env.example` documents required keys.

## 6. Environments

`local` (Supabase CLI) → `staging` (Supabase branch + Vercel preview) → `production`. Migrations are the source of truth; never edit the DB by hand. Mobile ships via EAS channels (preview/production) with OTA for JS-only changes.

## 7. Why custom commerce (not Shopify)

Chosen by the product owner. Trade-off accepted: more to build, but full control over the **unified** model where an order, its delivery, its installation job, its warranty, and its support tickets are all first-class rows with referential integrity — impossible to model cleanly when commerce lives in an external SaaS. Zoho Books still handles accounting; Zoho Desk backs support.
