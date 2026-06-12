---
name: newtech-os
description: Codegraph + conventions for the Newtech OS monorepo (CRM/ERP/commerce/accounting/AI). Use at the START of any feature work, bug fix, or planning in this repo — gives the module map (DB→seam→action→page→edge fn), hard rules, and the build workflow so development never drifts.
---

# Newtech OS — Codegraph & Build Rules

**Read `docs/INTEGRATED_OS_BLUEPRINT.md` for the full forward plan (phases 0025–0036).**
Live status: `docs/STATUS.md`. Supabase project: `elite-v1` (wslvotaodwdftmexkfpd).

## Module map (DB table → server seam → actions → page)

| Domain | Tables (migration) | Seam `apps/web/lib/` | Actions `app/[locale]/admin/.../actions.ts` | Page |
|---|---|---|---|---|
| Orders | orders, order_items, payments, **order_events** (0018: audit trigger), tags/internal_note, **channel** (0022) | admin-orders.ts | orders/ (status→notify, note→audit, tags, **createReturn/settleReturn**) | /admin/orders, [id], **[id]/invoice?type=invoice\|packing\|quote** |
| Returns | returns, return_items (0021, RMA-#) | — (via orders) | orders/ settleReturn → ledger 'return' + neg. payment | RMA dialog in order detail |
| Inventory | inventory, **stock_moves** (0019 immutable ledger), locations | admin-inventory.ts | catalog/inventory/ (adjust/transfer/addLocation → **RPC apply_stock_move/transfer_stock ONLY**) | /admin/catalog/inventory (matrix/ledger/serials/locations tabs) |
| Purchasing | suppliers, purchase_orders (PO-#), purchase_order_items, **product_serials** (0019) | admin-purchasing.ts | purchasing/ (createPo, receivePoLine → serials+batch+ledger) | /admin/purchasing |
| POS | orders(channel='pos') | admin-pos.ts | cashier/ (completeSale, **saveQuote**=draft order) | /admin/cashier |
| Customers/CRM | profiles(+loyalty_points 0022), **customer_notes** (0023) | admin-customers.ts, admin-customer.ts (360) | customers/[id]/ (notes/tasks) | /admin/customers, [id] (timeline+devices+notes) |
| Dispatch | fulfillment_tasks, driver_locations | admin-dispatch.ts | dispatch/ (reassign, autoAssign→planAssignments) | /admin/dispatch (+LiveOpsMap leaflet, SLA via isLate) |
| Workshop | installation_jobs | admin-workshop.ts | — | /admin/workshop |
| Appointments | appointments (0024: installation/inspection/pickup) | — (inline in page) | appointments/ | /admin/appointments |
| Finance | expenses, (derived from orders/payments) (0016) | admin-finance.ts | — | /admin/finance |
| Marketing | marketing_campaigns (0016), discounts | admin-marketing.ts | marketing/ (discount CRUD) | /admin/marketing |
| Settings | app_settings (singleton), delivery_zones (0017) | admin-settings.ts | settings/ | /admin/settings |
| Analytics | RPCs admin_* + live reads (channel/payments/customers) | admin-analytics.ts | — | /admin/analytics |

**Edge functions** (`supabase/functions/`): checkout, payment-webhook, dispatch, notify, ai-copilot, daily-report, whatsapp-webhook, chatwoot-webhook, **sync-catalog** (Shopify→DB, SKU-dedup). Shared: `_shared/{anthropic,whatsapp,payment,supabaseAdmin,cors,aggregates}.ts`.

**Pure tested logic** (`apps/web/lib/pure/` — vitest, CI-gated): order-timeline (eventsToTimeline), customer-tier (tierOf RFM), dispatch-assign (planAssignments), money (round3/ticketTotal/deliveryFee), inventory (poStatusFromItems/parseSerials/validateReceive/stockValue), ops (isLate/pointsFor/normalizeChannel). **Live code MUST import these — never duplicate.**

## Hard rules
1. **Stock changes ONLY via `apply_stock_move`/`transfer_stock` RPCs** (atomic ledger). Never UPDATE inventory directly.
2. **Money = KWD numeric(10,3)**; round with `round3`. 3 decimals everywhere.
3. **Every seam**: live read via `getServerClient()` (RLS-gated) → clearly-marked sample fallback. Pages always render.
4. **RLS on every new table** (`is_ops()`/`is_admin()` helpers); SECURITY DEFINER fns: pin `search_path=public`, check `is_ops()` inside, revoke from public/anon (see 0020 incident).
5. **Migrations**: next number sequential (0025+ per blueprint), idempotent (`if not exists`), additive; write file in `supabase/migrations/` AND apply live via Supabase MCP `apply_migration`.
6. **Arabic-first RTL** UI (OSALPHA gold tokens `osa-*`); bilingual ar/en strings inline.
7. New pure logic → `lib/pure/` + tests in `__tests__/`.

## Build workflow (every batch)
1. Branch `claude/*` reset on latest master → migration (file+apply live) → pure+tests → seam → actions → UI → sidebar nav if new page.
2. Gates (all must PASS): `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm --filter @elite/web build`.
3. Smoke: `npx next start -p 3100` (in apps/web) + curl routes → 200.
4. Commit (detailed message + session link) → push → draft PR → CI green → user merges (Ready+Squash).
5. Production = master auto-deploys to Vercel `remotion-project-6dvr` (root apps/web).

## Gotchas
- Generated DB types are permissive; cast joined rows `as unknown as Shape`.
- Repo-root `vercel.json` breaks the apps/web Vercel project — never add one.
- turbo strict env: proxy/CA vars passed via `globalPassThroughEnv` (fonts fetch).
- Toast in catalog: `toast(msg, { tone })`; orders toast: `toast(msg, 'success'|'error')`.
