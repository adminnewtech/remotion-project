# Newtech OS — دليل التطوير المحلي الكامل (Local Development)

> آخر تحديث: 2026-06-12 — بعد المرحلتين 1+2 من المخطط (محاسبة قيود مزدوجة + محرّك أتمتة CRM). الحالة الحية: `STATUS.md` · الخطة: `INTEGRATED_OS_BLUEPRINT.md` · قواعد البناء: `.claude/skills/newtech-os/SKILL.md`.

## 1) المتطلبات
- **Node ≥ 20** + **pnpm 9** (`corepack enable`)
- Supabase CLI (اختياري للتطوير المحلي للـDB): `npm i -g supabase`
- حساب على مشروع Supabase `elite-v1` (ref: `wslvotaodwdftmexkfpd`) أو مشروع خاص بك

## 2) الإقلاع
```bash
git clone https://github.com/adminnewtech/remotion-project && cd remotion-project
pnpm install
cp .env.example apps/web/.env.local      # واملأ مفاتيح Supabase العامة على الأقل
pnpm dev                                  # turbo: web (Next.js) + mobile (Expo)
```
- **Web** فقط: `pnpm --filter @elite/web dev` → http://localhost:3000/ar
- **Mobile**: `pnpm --filter @elite/mobile dev` (Expo Go)
- بدون env: كل الصفحات تشتغل بـ**sample fallback** — ما ينكسر شي.

## 3) بوابات الجودة (إلزامية قبل أي push — CI يفرضها)
```bash
pnpm typecheck   # 8 حزم
pnpm lint        # ESLint حقيقي للويب
pnpm test        # vitest — 55+ اختبار وحدة (lib/pure)
pnpm --filter @elite/web build
```
- **E2E** (Playwright, ضد رابط حي): `cd e2e && pnpm install && npx playwright install && BASE_URL=https://remotion-project-6dvr.vercel.app npx playwright test`
  - workflow: `.github/workflows/e2e.yml` (master + يدوي). يشمل `admin-smoke.spec.ts` (16 اختبار لكل صفحات الأدمن).

## 4) قاعدة البيانات (26 migration حية)
- الملفات: `supabase/migrations/0001…0026` — **idempotent** دائماً.
- إضافة migration: أنشئ `00XX_name.sql` ثم طبّقه حياً (Supabase MCP `apply_migration` من جلسة Claude، أو `supabase db push` بالـCLI الموصول).
- لا تعدّل المخزون مباشرة أبداً — فقط `apply_stock_move()` / `transfer_stock()`.
- المحاسبة (0025): الترحيل تلقائي بـtriggers — أي دفعة/مصروف/استلام مشتريات يقيّد نفسه. لا تكتب بـ`journal_*` يدوياً إلا عبر `post_journal()`.

## 5) Edge Functions (10 منشورة)
`checkout · payment-webhook · dispatch · notify · ai-copilot · daily-report · whatsapp-webhook · chatwoot-webhook · sync-catalog · automation-runner`
- محلياً: `supabase functions serve <name>` — النشر: عبر MCP أو `supabase functions deploy <name>`.
- الأسرار (Dashboard → Edge Functions → Secrets): انظر قسم Edge بـ`.env.example` (WhatsApp, Shopify, Anthropic, Payment…).

## 6) سير العمل على GitHub
- فرع `claude/*` أو `feat/*` من master → كوميتات موقّعة → push → **Draft PR**.
- CI (`ci.yml`): job `checks` (typecheck+lint+test) + job `build` — لازم أخضر.
- الدمج: **Ready + Squash**. master ينشر تلقائياً على Vercel (`remotion-project-6dvr`، الجذر `apps/web`).
- workflows مساعدة: `configure-vercel.yml` (إصلاح إعداد Vercel) · `deploy-vercel.yml` · `sync-catalog.yml`.

## 7) خريطة الكود
انظر **سكيل `newtech-os`** — جدول كامل: لكل دومين (الجداول → seam بـ`apps/web/lib/` → server actions → الصفحة) + فهرس المنطق الصافي المُختبَر بـ`lib/pure/` (الكود الحي يستورد منه حصراً).

## 8) فخاخ معروفة
- لا تضع `vercel.json` بجذر الريبو (يكسر مشروع Vercel).
- أنواع DB المولّدة متساهلة → cast عبر `as unknown as Shape` للصفوف الموصولة.
- turbo strict env: متغيرات البروكسي تمرّر عبر `globalPassThroughEnv`.
- حد Vercel المجاني 100 نشر/يوم — عند بلوغه ينتظر النشر 24h (الكود يُدمج عادي ويلحق).
