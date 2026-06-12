# Elite OS — Design Taste & UX Guide

> Governing design spec for the Elite OS redesign. Arabic-first (RTL) e-commerce + operations platform for Newtech Kuwait. Stack: Next.js + Tailwind + `@elite/ui`.
> This document is **opinionated and prescriptive**. Implementation agents follow it literally. When a rule and a Figma mock disagree, the rule wins unless a designer overrides in writing.
> Last updated 2026-06-12.

---

## 1. North Star

Elite OS should feel **quiet, fast, and precise** — like Linear and the Stripe Dashboard wearing Arabic. The storefront is calm and confident (Apple/premium-Shopify restraint), the admin is dense but never noisy (Linear/Tremor information density with breathing room). Every screen reads in one glance: one primary action, one focal metric, everything else recedes. We earn "premium" through restraint — generous whitespace, a tight neutral palette, hairline borders over heavy shadows, and motion under 200ms that makes the product feel instantaneous. Arabic is the default and the design is built RTL-first, not retrofitted; bilingual ar/en must look equally deliberate.

**The three tests for any screen:** Is the hierarchy obvious in 2 seconds? Is the primary action unmistakable? Does it feel instant?

---

## 2. Token System

All tokens live in `@elite/ui` as CSS variables + Tailwind theme extension. Values below are the source of truth.

### 2.1 Spacing (4px base grid)

Never use arbitrary pixel values. Snap everything to the scale.

| Token | px | Use |
|------|----|----|
| `space-0` | 0 | — |
| `space-1` | 4 | icon-to-text gap, tight inline |
| `space-2` | 8 | inner control padding, badge padding |
| `space-3` | 12 | input padding, compact row padding |
| `space-4` | 16 | default component padding, card inner |
| `space-5` | 20 | — |
| `space-6` | 24 | card padding (comfortable), section gap |
| `space-8` | 32 | between groups |
| `space-10` | 40 | — |
| `space-12` | 48 | major section separation |
| `space-16` | 64 | page-level vertical rhythm |

Rule (Refactoring UI): start with **more** whitespace than feels right, then remove. Group with whitespace before reaching for borders.

### 2.2 Type scale

Body font: **Geist** (Latin) — weights 400/500/600 only. Arabic font: **IBM Plex Arabic** primary (Cairo or Tajawal acceptable fallback). Numerals: **Geist** for tabular/financial figures, Western/Arabic numerals (1,2,3) by default for Gulf; expose Arabic-Indic (١,٢,٣) as a user preference.

Hierarchy comes from **weight + color**, not just size. Default body weight 400; emphasize by shifting to **500/600**, not 700. (This 400→500 shift is the shadcn/Geist "high taste" signature.)

| Token | size / line-height | weight | Use |
|------|-----|------|----|
| `text-display` | 30 / 36 | 600 | page hero (storefront only) |
| `text-h1` | 24 / 32 | 600 | page title |
| `text-h2` | 20 / 28 | 600 | section heading |
| `text-h3` | 16 / 24 | 600 | card title, KPI label group |
| `text-body` | 14 / 20 | 400 | default UI + admin body |
| `text-body-lg` | 16 / 24 | 400 | storefront body |
| `text-sm` | 13 / 18 | 400 | secondary, table cells (dense) |
| `text-xs` | 12 / 16 | 500 | labels, badges, captions, table headers (uppercase optional, never on Arabic) |
| `text-metric` | 28 / 32 | 600, **tabular-nums** | KPI hero number |

**Arabic adjustments (mandatory):** Arabic glyphs render ~10–15% smaller visually — bump Arabic font-size +1–2px vs Latin equivalent, and add **+0.1–0.15 to line-height**. **Never apply `letter-spacing` to Arabic** (breaks cursive joins). Prefer 500 weight minimum for Arabic body — 400 can look thin.

Always set `font-variant-numeric: tabular-nums` on any column of numbers (prices, quantities, KPIs) so digits align.

### 2.3 Radius

| Token | px | Use |
|------|----|----|
| `radius-sm` | 6 | badges, inputs, small controls |
| `radius-md` | 8 | buttons, cards (default `--radius`) |
| `radius-lg` | 12 | modals, large cards, popovers |
| `radius-xl` | 16 | storefront feature cards |
| `radius-full` | 9999 | avatars, pills, icon buttons |

One consistent default (`8px`). Nested radius rule: inner radius = outer − padding (a card at `radius-lg` with 8px inset → inner element `radius-md`).

### 2.4 Shadow / elevation (borders first, shadows sparingly)

Prefer a **hairline border** (`border-default`) to define edges. Reserve shadows for genuinely floating layers. Never stack a heavy shadow on an admin table.

| Token | value | Use |
|------|------|----|
| `shadow-none` | none | flat content, table rows |
| `shadow-xs` | `0 1px 2px rgba(0,0,0,.05)` | resting card hover, buttons |
| `shadow-sm` | `0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)` | dropdown, hovered card |
| `shadow-md` | `0 4px 12px rgba(0,0,0,.10)` | popover, command palette |
| `shadow-lg` | `0 12px 32px rgba(0,0,0,.14)` | modal, dialog |

Dark mode: drop shadow opacity, lean on `border` + a slightly lighter surface (`card` lighter than `background`) for elevation instead.

### 2.5 Color roles (semantic, not literal)

Follow the shadcn/Radix role model. Components reference **roles**, never raw hex. Restraint rule (Tremor/dashboard best practice): **color = status, never decoration.** Neutrals carry 90% of the UI.

| Role | Use |
|------|----|
| `background` / `foreground` | app canvas + primary text |
| `card` / `card-foreground` | surfaces sitting on background |
| `popover` / `popover-foreground` | floating menus, command palette |
| `primary` / `primary-foreground` | **one** brand action color — primary buttons, active nav, focus accent. Use sparingly. |
| `secondary` / `secondary-foreground` | secondary buttons, subtle fills |
| `muted` / `muted-foreground` | de-emphasized text, table headers, placeholders, metadata |
| `accent` / `accent-foreground` | hover backgrounds for rows/menu items |
| `destructive` | delete/danger only |
| `success` / `warning` / `info` | status badges, KPI deltas, toasts |
| `border` | hairline dividers + control outlines (default 1px) |
| `input` | form control border |
| `ring` | focus ring (derived from `primary`) |

Text contrast tiers: `foreground` (primary), `muted-foreground` (secondary), and a disabled tier. Three tiers max per surface.

### 2.6 Motion (the speed signature)

Sourced from Emil Kowalski (Linear/Vercel design-eng). **UI animation ceiling: <300ms; aim <200ms.** Faster reads as more responsive.

| Token | duration | easing | Use |
|------|---------|--------|----|
| `motion-instant` | 100ms | ease-out | button press, hover |
| `motion-fast` | 150ms | ease-out | dropdowns, tooltips, selects |
| `motion-base` | 200ms | ease-out | popovers, toasts, tabs |
| `motion-slow` | 300ms | ease-in-out | modal/drawer enter |
| `motion-drawer` | 350ms | drawer curve | side drawers/sheets |

Easing tokens:
- `ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)` — entries/appearing (default).
- `ease-in-out`: `cubic-bezier(0.77, 0, 0.175, 1)` — on-screen movement.
- `ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)` — iOS-style sheets.

**Hard rules:**
- **Never `ease-in` on UI** (delays initial movement → sluggish).
- **Never `transition: all`** — name exact properties.
- Animate only `transform` + `opacity`. Never animate `width/height/margin/padding/top/left`.
- Entry = `opacity:0` + `scale(0.95)`, never `scale(0)`.
- **Never animate keyboard-initiated actions** (run hundreds of times/day → feels laggy).
- Button `:active` → `transform: scale(0.97)` over 160ms.
- Stagger lists 30–80ms per item; never block interaction during stagger.
- Skip delay/animation on repeated tooltips and command-palette opens.
- RTL: motion must mirror direction — slide-in comes from the correct logical side.

---

## 3. Component Playbook

For each: structure → states → do/don't. References noted.

### DataTable *(refs: Linear, Stripe, tablecn/shadcn-admin, Pencil&Paper, Baymard)*
**Structure:** sticky header (`text-xs` muted, uppercase Latin only); rows `text-sm`, 40–44px (comfortable) or 32–36px (dense toggle); zebra OFF, hairline row borders ON; right-aligned numeric columns with `tabular-nums`; sticky first column (entity name) + sticky action column. Toolbar above table: search, filter chips, column visibility, density toggle, bulk-action bar (appears on selection).
**States:** default · hover (row gets `accent` bg) · selected (checkbox + subtle `primary`/10 tint) · loading (**skeleton rows**, not a spinner) · empty (illustration + message + primary CTA) · empty-filtered ("No results — Clear filters") · error (inline retry) · inline-edit (cell → input on double-click/Edit icon, Enter saves, Esc cancels, optimistic + toast undo).
**Do:** multi-select checkboxes + contextual bulk bar; clear sort indicator on active column; freeze header on scroll; keyboard nav (↑↓ rows, space to select, ⌘K context actions). **Don't:** heavy shadows, full-width borders everywhere, modal-per-edit when inline works, blank screen on empty, more than ~7 visible columns by default (push rest behind column toggle).

### Form / Field *(refs: Refactoring UI, Stripe, shadcn Form)*
**Structure:** label above input (`text-xs`/`text-sm` 500), input `radius-sm` 36–40px tall `text-body`, helper text below in `muted-foreground`, error replaces helper in `destructive`. Group related fields in titled sections (whitespace, not boxes). **Sticky action bar** at bottom (Cancel / Save) for long forms.
**States:** default · focus (2px `ring`, ≥3:1 contrast) · filled · error (border `destructive` + message + icon) · disabled · loading (button spinner, fields locked) · success (autosave → "Saved" microcopy + checkmark).
**Do:** validate on blur, not keystroke; preserve input on error; autosave where safe with explicit "Saved"/"Saving…" status; single-column layout (faster completion); RTL-aware (label/error align to start). **Don't:** inline-validate every keystroke; clear the form on submit error; place required asterisks as the only error signal; use placeholder as label.

### Button *(refs: Geist, shadcn, Emil motion)*
**Variants:** `primary` (filled brand — one per view region), `secondary` (subtle fill / outline), `ghost` (text only, toolbars), `destructive`, `link`. **Sizes:** sm 32px / md 36–40px / lg 44px. Icon-only buttons must be ≥24×24 hit target (prefer 36).
**States:** default · hover (`shadow-xs` + slight bg shift) · `:active` (`scale(0.97)`, 160ms) · focus-visible ring · loading (spinner replaces label, width locked, disabled) · disabled (reduced opacity, no pointer).
**Do:** one primary action per section; verb labels ("Save changes", "Add product"); leading icon optional, mirror directional icons in RTL. **Don't:** two primaries competing; animate keyboard-triggered presses; color secondary buttons with brand fill.

### Badge *(refs: Linear, Stripe statuses)*
**Structure:** `text-xs` 500, `radius-full` or `radius-sm`, `space-2` x-padding, optional 6px status dot. Status colors map to semantic roles: success/warning/destructive/info/muted.
**Do:** use a leading dot + text (not color alone — colorblind safety); consistent status→color mapping platform-wide. **Don't:** more than ~4 badge colors in one view; rely on color as the only signal.

### Card *(refs: Tremor, Geist)*
**Structure:** `card` bg, `border-default` hairline, `radius-lg`, `space-6` padding (comfortable) / `space-4` (dense). Optional header (title `text-h3` + action slot) and footer.
**Do:** group with whitespace inside; `shadow-none` resting, `shadow-xs` on interactive hover. **Don't:** nest cards in cards; heavy drop shadows; borders + shadow + bg fill all at once (pick one edge treatment).

### KPICard *(refs: Stripe Dashboard, Tremor)*
**Structure:** label (`text-xs` muted) → hero value (`text-metric`, **tabular-nums**, absolute number e.g. "د.ك 12,480" not "104% of target") → delta row: directional arrow + "+12.5%" + "vs last month" colored success/destructive → optional inline sparkline.
**Do:** explicit sign + arrow on delta; absolute hero number; 4–6 in a top strip. **Don't:** color the whole card; show ratios when the raw number matters more; omit the comparison period.

### Sidebar *(refs: Linear, shadcn-admin)*
**Structure:** 240–280px, collapsible to icon rail (~64px). Sections with `text-xs` muted group labels; items 36px, leading icon + label, active = `accent`/`primary` tint + 2px start-edge indicator. Pin search/command at top, user/account at bottom.
**Do:** RTL → sidebar on the **right**, indicator on the start (right) edge; collapse state persisted; ≤7 top items per group. **Don't:** deep nesting (>2 levels); icon-only without tooltips; mirror non-directional icons.

### Topbar *(refs: Stripe, Linear)*
**Structure:** breadcrumb/page title (start) · global search / ⌘K trigger (center or start) · actions, notifications, language switch (العربية / English by name), avatar (end). 56–64px, hairline bottom border.
**Do:** expose ⌘K everywhere; language switcher uses native names. **Don't:** duplicate sidebar nav here; overload with >4 end actions.

### Modal / Dialog *(refs: shadcn/Radix, Emil)*
**Structure:** centered, `radius-lg`, `shadow-lg`, max-width by purpose (sm 420 / md 560 / lg 720), dimmed scrim. Title `text-h2`, body, footer actions end-aligned (Cancel ghost + primary). Drawers/sheets for contextual edit (slide from start edge, `ease-drawer`).
**States:** enter (opacity + `scale(0.95)`→1, 300ms ease-out, scrim fades) · exit (faster, ~200ms). Focus trapped, Esc closes, focus returns to trigger.
**Do:** one decision per modal; destructive confirm restates consequence. **Don't:** modals for routine flows that fit inline/drawer; nested modals; animate from `scale(0)`.

### Tabs *(refs: Radix, Linear)*
**Structure:** underline style, active = `primary` indicator + 600 weight; `text-sm`. Indicator slides 200ms ease-out (skip animation if keyboard-driven repeatedly).
**Do:** RTL order right→left, indicator mirrors. **Don't:** >5 top tabs (use a select or nav); animate every keyboard tab change.

### Toast *(refs: Sonner/Emil)*
**Structure:** bottom-start (RTL bottom-right→ logical start), `radius-md`, `shadow-md`, icon + message + optional Undo action. Auto-dismiss 4–5s; errors persist until dismissed.
**Do:** pair destructive actions with **Undo** toast instead of confirm dialog where reversible; stack with 30–80ms stagger. **Don't:** toast for validation errors (show inline); block UI.

### EmptyState *(refs: Baymard, shadcn-admin)*
**Structure:** centered — small illustration/icon → title (`text-h3`) → one-line muted explanation → **primary CTA** (+ secondary link). Distinct copy for "no data yet" vs "no results for filter".
**Do:** make the CTA the obvious next step ("Add first product" / "Clear filters"). **Don't:** show a bare empty table; reuse the same copy for both empty types.

### ProductCard *(refs: Apple, premium Shopify, Noon, Baymard)*
**Structure:** square/4:5 image (lazy, fixed aspect to prevent CLS) → title (`text-body`, 2-line clamp) → price (`text-body` 600, tabular-nums; strikethrough original + sale in `destructive`) → rating + review count → stock/badge ("In stock"/"Installation available") → Add-to-cart (appears/!solid on hover desktop, always visible mobile). 44px tap targets.
**Do:** show price + shipping/install signal on the card; consistent image framing; quick-add. **Don't:** hover-only CTA on touch; mismatched image crops; hide price.

### PDP *(refs: Baymard, Shopify 2025, Apple)*
**Structure:** gallery (start, large + thumbs/zoom) · buy box (end): title, price, variants (chips not dropdowns where ≤6), quantity, **Add to cart** (primary, sticky on mobile), delivery + **installation** estimate shown **here, not at checkout**, trust signals. Below: spec table (short labels, one-col), description, UGC/reviews, related carousel.
**Do:** show shipping/install cost + ETA early; specs as scannable table; one unmistakable primary CTA; sticky buy bar on mobile. **Don't:** competing CTAs; bury price/shipping; desktop layout shrunk for mobile (design mobile-first).

---

## 4. Admin Density & Layout Rules

- **One job per screen.** Lead with 3–5 high-value metrics top-start.
- 12-column grid below the KPI strip; 240–280px sidebar; group with whitespace, not borders.
- Offer a **density toggle** (comfortable 40–44px / compact 32–36px rows). Default comfortable.
- **Skeletons over spinners** for content; spinners only for <1s button actions.
- Keyboard-first: ⌘K command palette (context-aware actions), `/` to focus filter, arrow-key row nav, single-key shortcuts for frequent actions. Show shortcut hints in menus/tooltips (Linear pattern).
- Color = status only. Charts: line=trend, bar=comparison, table=detail. Numbers right-aligned, tabular.
- ≤7 visible columns / ≤7 nav items per group by default; everything else progressive-disclosed.
- Perceived speed: optimistic updates + undo, prefetch on hover, instant local sort/filter.

## 5. RTL / Arabic Rules

- **RTL-first.** Build with CSS **logical properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`) — never `left/right`. `dir="rtl"` on `<html>` flips the whole app from one stylesheet.
- Sidebar → right; primary content flows right→left; default cursor/reading start = right.
- **Mirror directional icons only** (arrows, chevrons, back/next, progress, breadcrumb separators). **Do NOT mirror** logos, search, user, settings, gear, media play, clocks, or brand glyphs.
- **Numbers, prices, phone numbers, Latin brand names stay LTR** inside RTL text — let the Unicode bidi algorithm handle it; wrap with `bdi`/`dir="ltr"` where mixed content misorders.
- Arabic type: +1–2px size and +0.1–0.15 line-height vs Latin; **no letter-spacing**; min weight 500 for body; font IBM Plex Arabic / Cairo / Tajawal.
- Language switcher labeled in native script (العربية / English), consistent location.
- **Test with real Arabic content** — never Lorem Ipsum (Latin won't trigger RTL bugs). QA both directions every screen.
- Motion mirrors: slide/drawer enters from the correct logical edge in RTL.

## 6. Storefront Conversion Rules

- Show **price, shipping/free-shipping threshold, and installation availability + ETA on the PDP** (and card), not deferred to checkout.
- One unmistakable primary CTA per page; sticky Add-to-cart on mobile.
- High-quality, consistently-framed imagery; fixed aspect ratios to kill layout shift.
- Variant selection as chips when ≤6 options; quantity stepper; clear stock status.
- Reviews + UGC above the fold; spec table with short labels.
- Checkout: minimize steps and fields, autoformat card number (spaces), guest checkout, show order summary persistently, no surprise costs late. Cross-sell carousel with image + price + quick-add.
- Mobile-first: design for small screens first, 44px targets, thumb-reachable CTAs.

## 7. Accessibility Checklist (WCAG 2.2 AA)

- [ ] Text contrast ≥ **4.5:1** (normal), ≥ **3:1** (large ≥18.66px/24px or bold ≥14px).
- [ ] Non-text/UI component + state contrast ≥ **3:1** (borders, icons, focus).
- [ ] **Focus indicator:** visible on every interactive element, ≥2px thick, ≥3:1 contrast vs both the unfocused element and adjacent colors (2.4.11). Never `outline:none` without a replacement ring.
- [ ] Focus order logical (and correct in RTL); focus never obscured (2.4.11/2.4.12).
- [ ] **Target size ≥ 24×24px** CSS (aim 44px on touch) (2.5.8).
- [ ] Full keyboard operability; visible focus path; ⌘K and shortcuts documented; no keyboard traps.
- [ ] Semantic structure: one `<h1>`/page, ordered headings, `<table>` for tabular data, `<button>` vs `<a>` correctly, form `<label>` associations.
- [ ] `prefers-reduced-motion`: drop transform/movement, keep opacity/color fades only.
- [ ] Status not conveyed by color alone (dot/icon/text alongside).
- [ ] `lang` attribute set per language; `dir` correct; bidi handled for mixed content.
- [ ] Images have meaningful `alt`; decorative images `alt=""`.
- [ ] Error messages programmatically associated + announced (aria-live for toasts/inline).

## 8. Anti-Patterns to Avoid

- `transition: all` and `ease-in` on UI; animating layout properties; animating keyboard actions.
- Heavy/multiple drop shadows; border + shadow + fill stacked on one element.
- Color as decoration; >4 status colors in a view; status by color alone.
- Hierarchy by size only (use weight + color); body weight jumping 400→700.
- Bold weights / `letter-spacing` on Arabic; thin Arabic text; mirroring non-directional icons.
- `left/right` CSS instead of logical properties; testing RTL with Latin placeholder.
- Placeholder-as-label; validate-on-keystroke; clearing forms on error; modal for routine inline edits.
- Blank empty states; spinners where skeletons belong; dense tables with no density relief.
- Two competing primary buttons; hover-only CTAs on touch; price/shipping hidden until checkout.
- Arbitrary off-grid spacing; raw hex instead of semantic role tokens.

---

## 9. Taste Checklist (run against every screen — pass/fail)

1. Visual hierarchy obvious within 2 seconds; clear focal point top-start.
2. Exactly one primary action per region; it's unmistakable.
3. All spacing on the 4px grid; generous whitespace; groups separated by space, not boxes.
4. Hierarchy built from **weight + color**, not size alone; ≤3 text tiers per surface.
5. Hairline borders preferred over shadows; no heavy/stacked shadows; one edge treatment per element.
6. Color used only for status/brand accent; neutrals dominate; ≤4 status colors visible.
7. Numbers are tabular-nums and right-aligned in columns; prices consistent.
8. Motion is <200ms, ease-out, transform/opacity only; no `ease-in`, no `transition:all`, no animated keyboard actions.
9. Every interactive element has a visible ≥2px, ≥3:1 focus ring; targets ≥24px (44px touch).
10. Text contrast ≥4.5:1 (≥3:1 large/UI); status never color-only.
11. Empty, loading (skeleton), and error states are all designed — no blank screens or lone spinners.
12. Tables: sticky header, ≤7 default columns, bulk-select bar, density toggle, inline-edit where sensible.
13. Forms: labels above, validate on blur, input preserved on error, sticky save actions, single column.
14. RTL correct: logical properties only, sidebar/flow mirrored, only directional icons flipped, numbers/Latin stay LTR.
15. Arabic typography: +size/+line-height, no letter-spacing, weight ≥500, real Arabic content tested.
16. Storefront: price + shipping + installation shown on card/PDP; mobile sticky CTA; fixed image aspect (no CLS).
17. Feedback is immediate: optimistic updates, undo toasts for reversible/destructive actions.
18. `prefers-reduced-motion` honored (opacity/color only).
19. Component uses `@elite/ui` tokens/roles — zero raw hex, zero off-grid values.
20. Nothing competes for attention that shouldn't; the screen feels quiet, fast, and precise.

---

## 10. References

- shadcn/ui — design philosophy, theming/role tokens, Geist type, 4px spacing: https://ui.shadcn.com/ · https://ui.shadcn.com/docs/theming · https://www.typeui.sh/design-skills/shadcn
- Radix UI primitives (Vercel/Linear/Supabase adoption): https://www.radix-ui.com/ · https://workos.com/blog/what-is-the-difference-between-radix-and-shadcn-ui
- Vercel Geist design system: https://vercel.com/geist/introduction
- Emil Kowalski — design-eng motion/taste rules (durations, easings, micro-interactions): https://github.com/emilkowalski/skill/blob/main/skills/emil-design-eng/SKILL.md · https://emilkowal.ski/
- Linear — speed, keyboard-first, command menu, invisible details: https://linear.app/docs/conceptual-model · https://medium.com/linear-app/invisible-details-2ca718b41a44 · https://telablog.com/the-elegant-design-of-linear-app/
- Refactoring UI (Wathan/Schoger) — hierarchy, whitespace, shadows, contrast: https://medium.com/design-bootcamp/top-20-key-points-from-refactoring-ui-by-adam-wathan-steve-schoger-d81042ac9802 · https://www.sglavoie.com/posts/2023/09/09/book-summary-refactoring-ui/
- Tremor — dashboard components, KPI/sparkline, color-for-status: https://www.shadcn.io/template/tremorlabs-tremor · https://makerstack.co/reviews/tremor-review/
- Stripe dashboard KPI pattern (value + delta + sparkline), dashboard layout: https://www.aidesigner.ai/blog/how-to-design-a-dashboard-ui · https://databox.com/dashboard-examples/stripe-dashboards
- Admin dashboard / data table UX (sorting, bulk, inline-edit, empty/loading): https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables · https://www.justinmind.com/ui-design/data-table · https://stephaniewalter.design/blog/essential-resources-design-complex-data-tables/
- shadcn-admin / dashboard templates (sidebar, ⌘K, RTL): https://github.com/satnaing/shadcn-admin · https://github.com/arhamkhnz/next-shadcn-admin-dashboard · https://github.com/Kiranism/next-shadcn-dashboard-starter
- RTL / Arabic best practices (type, numerals, mirroring, logical props): https://aivensoft.com/en/blog/rtl-arabic-website-design-guide · https://medium.com/blackboard-design/fundamentals-of-right-to-left-ui-design-for-middle-eastern-languages-afa7663f66ed · https://design.fusionfabric.cloud/foundations/rtl
- E-commerce PDP / checkout conversion (Baymard, Shopify 2025): https://baymard.com/research/product-page · https://www.shopify.com/blog/what-is-pdp-in-ecommerce · https://www.convertcart.com/blog/ecommerce-checkout-ux-design · https://www.mobiloud.com/blog/ecommerce-product-detail-page-best-practices
- Accessibility WCAG 2.2 AA (contrast, focus 2.4.11, target 2.5.8): https://www.w3.org/TR/WCAG22/ · https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ · https://webaim.org/blog/wcag-2-2-overview-and-feedback/
