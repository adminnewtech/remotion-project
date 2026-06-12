# OSALPHA — Gold Admin Design System

> The live admin design system for Elite v1 / Newtech Kuwait. Arabic-first (RTL),
> light + dark, gold brand. Source-of-truth mockup: the OSALPHA reference HTML.
> This is the system the **admin shell + overview** are built on; other admin
> pages should migrate to it incrementally (see "Adoption" below).
> Last updated 2026-06-12.

---

## 1. Token system

Tokens are defined once and exposed three ways so plain CSS, Tailwind classes,
and the React Native app all stay in sync:

- **Raw values** — `@elite/ui` → `packages/ui/src/tokens.ts` (`osalpha`, `osalphaDark`).
- **CSS variables** — `apps/web/app/globals.css` (`:root` light + `[data-theme="dark"]`).
- **Tailwind tokens** — `@elite/config/tailwind-preset` → `colors.osa.*`,
  `borderRadius.osa{,-sm}`, `boxShadow.osa`.

Use the Tailwind `osa-*` classes (`bg-osa-surface`, `text-osa-ink`,
`border-osa-border`, `text-osa-brand`, `rounded-osa`, `shadow-osa`, …). They are
CSS-var backed, so `[data-theme="dark"]` re-themes everything with no class
changes.

### Variables (CSS custom properties)

| Variable | Light | Dark |
|---|---|---|
| `--osa-canvas` | `#F6F6FB` | `#12101F` |
| `--osa-surface` | `#FFFFFF` | `#1A1730` |
| `--osa-surface-2` | `#F2F1F9` | `#231F3D` |
| `--osa-border` | `rgba(28,25,60,.08)` | `rgba(167,160,210,.10)` |
| `--osa-border-strong` | `rgba(28,25,60,.16)` | `rgba(167,160,210,.20)` |
| `--osa-ink` | `#1C193C` | `#EDEBFA` |
| `--osa-muted` | `#5D5A7D` | `#A7A0C8` |
| `--osa-faint` | `#9C99B5` | `#6F6A92` |
| `--osa-brand` | `#B8860B` | `#E3B341` |
| `--osa-brand-strong` | `#946E12` | `#C9A227` |
| `--osa-brand-dim` | `rgba(184,134,11,.12)` | `rgba(227,179,65,.12)` |
| `--osa-brand-border` | `rgba(184,134,11,.30)` | `rgba(227,179,65,.30)` |
| `--osa-brand-grad-from`→`-to` | `#946E12`→`#E2C66A` | `#C9A227`→`#E2C66A` |
| `--osa-aqua` (workshop accent) | `#0E9F8C` | `#2DD4BF` |
| `--osa-amber` | `#C2700A` | `#FBBF24` |
| `--osa-green` | `#15803D` | `#34D399` |
| `--osa-blue` | `#2563EB` | `#60A5FA` |
| `--osa-rose` | `#E11D48` | `#FB7185` |
| `--osa-shadow` | hairline+soft | `none` |

Each status color also has a `*-dim` tinted-background pair (e.g.
`--osa-amber-dim`). **Brand is gold; `aqua` is the teal workshop accent.**
Color is status/brand only — neutrals carry the UI.

- **Radii:** card `16px` (`rounded-osa`), control `10px` (`rounded-osa-sm`), pill `99px`.
- **Shadow:** `shadow-osa` (none in dark — lean on borders + lighter surfaces).

### Typography & numbers

Fonts are loaded with `next/font` in `app/[locale]/layout.tsx` and exposed as CSS
vars: `--font-cairo` (headings), `--font-plex-arabic` (body), `--font-plex-mono`
(numbers). The `.osa-root` scope (set by the admin layout) applies them so the
storefront's typography is untouched.

Any price / count / metric gets the **mono LTR tabular** treatment — add the
`.num` (or `.tabular`) class. Money is **KWD, 3 decimals** (`1,180.250`), with the
`د.ك` currency in a separate faint span.

---

## 2. Theme switching

- A pre-paint inline script in the locale layout reads `localStorage['osalpha-theme']`
  (falling back to `prefers-color-scheme`) and sets `data-theme` on `<html>` before
  first paint — no flash.
- `components/admin/theme-toggle.tsx` (client) flips `data-theme` and persists the
  choice. The topbar renders it as an icon button.
- `prefers-reduced-motion` is honored globally (transitions disabled).

---

## 3. Shell

`app/[locale]/admin/layout.tsx` composes the shell inside the existing
auth + role gate:

- **`components/admin/sidebar.tsx`** — 240px rail: gold gradient logo mark,
  store-pill, grouped nav (الرئيسية / الخدمات / العملاء والتسويق / الإدارة) with
  Arabic+English labels, badges, and a bottom user card. Nav maps to existing
  routes (`/orders`, `/catalog`, `/dispatch`, `/support`, `/marketing`,
  `/finance`, `/staff`, `/ceo`); not-yet-built items (الكاشير / الورشة / العملاء)
  link to the graceful `/admin/soon` ("قريباً") placeholder. Role-filtered.
- **`components/admin/topbar.tsx`** — greeting + Gregorian/Hijri date, pill search,
  notification + theme-toggle icon buttons, and the single gold primary action.
- **`components/admin/status-bar.tsx`** — fixed bottom integration-sync chips
  (Shopify / Zoho Books / Yeastar) + open-shift indicator.

---

## 4. Overview (the index dashboard)

`app/[locale]/admin/page.tsx` → `fetchOverview()` (server) →
`components/admin/overview/` (client). Sections + data sources:

| Section | Live source (`@elite/core`) |
|---|---|
| AI brief bar | derived (delta/alerts) |
| 4 KPI cards (sales / orders / shift cash / receivables) | `analytics.getDashboard` (revenueByDay + ordersByStatus) |
| Sales-by-channel area chart | `analytics.getRevenueByDay` (split per channel) |
| Top products + share bars | `analytics.getTopProducts` |
| Latest orders table | `orders.listOrders` |
| Live workshop bays | sample (workshop module pending) |
| Today's tasks checklist | sample (tasks roll-up pending) |

`fetchOverview` reads through the request-scoped Supabase client and falls back to
the documented sample (`lib/overview-sample.ts`) per-section when env is absent or
a read is empty — the dashboard always renders. The chart is a lightweight inline
SVG (`Sparkline`), no chart library.

---

## 5. New shared primitives (`@elite/ui/web`)

`packages/ui/src/web/osalpha.tsx` — all `osa-*` token-driven, RTL-safe, theme-aware:

- `StatusPill` — order/task state pill (`new`/`prep`/`done`/`late`/`brand`/`neutral`).
- `PayChip` — outlined payment-method chip.
- `ProgressBar` — thin share/progress track (`brand` or `aqua`).
- `Sparkline` — multi-series inline SVG line/area chart (no lib).
- `Checklist` — read-only task checklist.

`KpiCard` (existing) is unchanged and still exported. All prior `@elite/ui`
exports keep working.

---

## 6. Adoption (other admin pages)

When migrating an existing admin page to OSALPHA:

1. The shell, `.osa-root` scope, topbar, and status bar are already provided by
   the admin layout — pages render only their body.
2. Replace surfaces/text with `osa-*` Tailwind tokens
   (`bg-osa-surface border-osa-border rounded-osa shadow-osa text-osa-ink/muted/faint`).
3. Brand actions/active states use `text-osa-brand` / `bg-osa-brand-dim`;
   the single primary action uses `bg-osa-brand` + the `osa-btn-primary` class.
4. Use the shared primitives (`StatusPill`, `PayChip`, `ProgressBar`,
   `Sparkline`, `Checklist`, `KpiCard`) instead of bespoke markup.
5. Numbers → `.num`; money → KWD 3-decimals with a faint `د.ك` span.
6. RTL: logical properties only (`ms-*`/`me-*`/`ps-*`/`pe-*`/`start`/`end`),
   never `left/right`. Mirror only directional icons.
7. Verify both `data-theme="light"` and `="dark"`.
