# Elite v1

> منصّة التشغيل والتجارة الموحّدة لـ **Newtech** (newtechq8.com) — إلكترونيات حديثة، تركيب، وتوصيل في الكويت.
>
> The unified commerce + operations super-app for **Newtech** — modern electronics retail, professional installation, and delivery in Kuwait.

Elite v1 is a single platform (web + iOS + Android) that serves **five roles** from one codebase:

| الدور / Role | ماذا يفعل / What they do |
|---|---|
| 🛍️ **العميل / Customer** | يتصفّح، يطلب، يدفع، يتتبّع التوصيل والتركيب لحظياً، يفتح تذاكر دعم وضمان |
| 🧑‍💼 **الإدارة / Admin** | لوحة تحكم كاملة: مبيعات، مخزون، تسعير، تحليلات، إدارة الأدوار، تسويق |
| 👷 **الموظف / Employee** | معالجة الطلبات، خدمة العملاء، إدارة الكتالوج والمخزون |
| 🔧 **الفني / Technician** | جدولة مهام التركيب، الخريطة، إثبات الإنجاز، التقاط الصور والتوقيع |
| 🚚 **السائق / Driver** | استلام مهام التوصيل، تتبّع GPS لحظي، إثبات التسليم (POD) |

## نظرة معمارية سريعة / Architecture at a glance

```
Expo (iOS/Android)  ──┐
                      ├──►  packages/core (Supabase client + domain logic)  ──►  Supabase
Next.js (Web/Vercel) ─┘                                                          (Postgres + Auth
                                                                                  + Realtime + Storage
                                                                                  + Edge Functions)
                                          │
                                          └──►  Integrations: Zoho Books · Zoho Desk · Gmail · Meta Ads · Cloudflare
```

- **Commerce engine:** custom, fully on Supabase (catalog, cart, checkout, orders, payments).
- **Backend:** Supabase — Postgres + Row Level Security + Realtime + Storage + Edge Functions.
- **Web:** Next.js (App Router) on Vercel — storefront + admin dashboard.
- **Mobile:** Expo / React Native — customer, driver, and technician experiences.
- **Shared:** TypeScript everywhere, RTL-first (Arabic) with English, design tokens shared web↔mobile.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) · [`docs/FEATURES.md`](docs/FEATURES.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Monorepo layout

```
elite-v1/
├── apps/
│   ├── web/        Next.js — storefront + admin dashboard (Vercel)
│   ├── mobile/     Expo — customer + driver + technician
│   └── video/      Remotion — marketing video studio (existing Newtech content)
├── packages/
│   ├── types/      Shared domain types + generated DB types (the contract)
│   ├── core/       Supabase client, data access, domain/business logic
│   ├── ui/         Cross-platform design system (tokens + primitives)
│   ├── i18n/       Arabic (RTL) + English translations
│   └── config/     Shared tsconfig / eslint / tailwind presets
├── supabase/
│   ├── migrations/ SQL schema + Row Level Security (source of truth)
│   └── functions/  Edge Functions (checkout, dispatch, webhooks, notifications)
└── docs/           Architecture, data model, features, roadmap
```

## Getting started (after infra is provisioned)

```bash
pnpm install
cp .env.example .env.local        # fill in Supabase / integration keys
pnpm db:push                      # apply migrations to your Supabase project
pnpm dev                          # run web + mobile in parallel (turbo)
```

> **Status (2026-06-12):** **LIVE.** 26 migrations on Supabase `elite-v1`, 10 edge functions deployed, web on Vercel (production = `master`). Full native admin OS: orders+audit trail, multi-location inventory ledger, purchasing+serials, RMA, POS+quotes, CRM-360+segments+notes, loyalty, dispatch+live GPS map+SLA, appointments, invoices/packing, settings/zones, **double-entry accounting (auto-posting)**, **CRM automation engine** — 55+ unit tests + 16 admin e2e in CI. Dev guide: `docs/DEVELOPMENT.md` · plan: `docs/INTEGRATED_OS_BLUEPRINT.md` · AI grounding: `CLAUDE.md`.
