# Elite v1 — Deployment & Live Infrastructure

## Live Supabase project (provisioned)

| | |
|---|---|
| Project name | `elite-v1` |
| Project ref | `wslvotaodwdftmexkfpd` |
| Region | `eu-central-1` (Frankfurt) |
| API URL | `https://wslvotaodwdftmexkfpd.supabase.co` |
| Publishable (anon) key | `sb_publishable_qUhviGOdAK1aNXzukWO13g_tJ1mV6a5` *(public-safe; RLS-protected)* |
| Service role key | **secret** — set only in Vercel/edge env, never in the repo |

**Applied:** migrations `0001`–`0008` (schema + RLS + atomic stock RPCs + security hardening) and a real catalog seed imported from the live Shopify store (`newtechq8.com`): 4 categories, 24 products, 30 variants, inventory, media, and a `NEWTECH10` discount.

> The anon/publishable key is designed for client exposure (every read is gated by Row Level Security). The **service role** key bypasses RLS and must stay secret.

## Environment variables

Copy `.env.example` → `.env.local` (web) / `.env` (mobile). The live values above are
already wired into `apps/web/.env.local` (gitignored). For mobile set
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the same.

## Deploy the web app to Vercel

The web app lives in a monorepo at `apps/web`. Two ways to deploy:

### A) Git integration (recommended)
1. In Vercel → **Add New Project** → import `adminnewtech/remotion-project`.
2. Set **Root Directory** = `apps/web`. Framework: Next.js. Vercel auto-detects the monorepo.
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = the API URL above
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key above
4. Deploy. Every push to the branch then produces a preview URL automatically.

### B) Vercel CLI / token
```bash
npm i -g vercel
vercel link            # select team "adminnewtech's projects"
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel deploy --prod --cwd apps/web
```

> ⚠️ **Sandbox note:** the Claude execution environment's network policy blocks
> outbound access to `*.supabase.co`, so a *local* run here shows sample-data
> fallbacks. On Vercel (open network) the same build reads the live catalog.

## Edge Functions (Supabase)

```bash
supabase link --project-ref wslvotaodwdftmexkfpd
supabase functions deploy checkout payment-webhook dispatch notify
supabase secrets set PAYMENT_WEBHOOK_SECRET=... EXPO_ACCESS_TOKEN=...
```

## Mobile (Expo / EAS)

```bash
cd apps/mobile
npx eas build --platform all --profile preview
```

## Catalog sync

`scripts/sync-shopify-catalog.ts` documents the Shopify → Supabase product import
used to seed the catalog; re-run it (or the admin "Catalog" screen) to refresh.
