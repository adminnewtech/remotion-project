# Elite v1 — Master Development Plan (نظام + متجر + كل شي)

Comprehensive, prioritized roadmap to evolve Elite v1 into the best-in-class
electronics + installation + delivery super-app for Kuwait. Grounded in the
competitive research in `RESEARCH_BLUEPRINT.md`. Status legend: ✅ live · 🟡 partial · 🔴 todo.

---

## Track 1 — Storefront & Customer Experience (الويب + الموبايل)
| Feature | Status | Priority |
|---|---|---|
| Premium homepage (hero, sections, category showcase) | 🟡 redesign in progress | P0 |
| Product cards with real images (Shopify CDN) | ✅ fixed | P0 |
| Product detail: gallery, variants, Buy+Install, specs, related | 🟡 | P0 |
| Instant search + filters (FTS + trigram) | ✅ backend · 🟡 UI | P0 |
| Reviews with photo/video + verified-purchase badge | 🔴 | P1 |
| Wishlist + back-in-stock / price-drop alerts (WhatsApp) | 🔴 | P1 |
| Bundles (product + accessories + install + warranty) | 🔴 | P1 |
| Loyalty points + paid subscription tier (Talabat-Pro style) | 🔴 | P2 |
| Referral program (WhatsApp share) | 🔴 | P2 |
| AI semantic/agentic bilingual search | 🔴 | P1 |
| AI recommendations (cross-sell / "installed with") | 🔴 | P2 |

## Track 2 — Checkout & Payments (الدفع)
| Feature | Status | Priority |
|---|---|---|
| KNET (primary) via MyFatoorah/Tap — production keys + webhooks | 🟡 wired, sandbox | P0 |
| Apple Pay / Google Pay one-tap | 🔴 | P0 |
| COD + WhatsApp COD-confirmation flow | 🟡 | P0 |
| Guest checkout + saved KW addresses + map pin | 🟡 | P0 |
| BNPL: Tabby + Tamara | 🔴 | P1 |
| Delivery + installation slot booking at checkout | 🟡 | P0/P1 |
| Promo codes / discounts engine | ✅ | P1 |

## Track 3 — Logistics & Field Service (التوصيل + التركيب = الميزة الحصرية)
| Feature | Status | Priority |
|---|---|---|
| Auto-dispatch by zone (driver/technician) | ✅ edge fn | P0 |
| Live GPS driver tracking + dynamic ETA (±2 min) | ✅ schema/app | P0 |
| Proof of delivery (photo + signature/OTP) | ✅ | P0 |
| Installation job flow (checklist, before/after photos, sign-off) | ✅ | P0 |
| Skills/SLA/parts-aware technician scheduling | 🔴 | P1 |
| AI multi-stop route optimization + idle reduction | 🔴 | P2 |
| Digital warranty card → one-tap service booking | 🔴 | P1 |

## Track 4 — Admin & Operations (لوحة الإدارة)
| Feature | Status | Priority |
|---|---|---|
| Dashboard KPIs (revenue, AOV, by-area, SLA) | ✅ analytics live | P0 |
| Orders management + audited refunds | 🟡 | P0 |
| Catalog & inventory management (CRUD) | 🟡 | P0 |
| Dispatch board (assign/reassign tasks) | 🟡 | P0 |
| Support tickets + chat (→ Zoho Desk) | 🟡 | P1 |
| Staff & roles + zones | ✅ | P0 |
| Marketing console (Meta catalog/campaigns) | 🟡 UI | P1 |
| Finance sync (Zoho Books invoices/expenses) | 🟡 adapter | P1 |
| Demand forecasting (stock + installer capacity) | 🔴 | P2 |

## Track 5 — Notifications & Engagement
| Feature | Status | Priority |
|---|---|---|
| DB triggers → push/email/in-app on milestones | ✅ live | P0 |
| WhatsApp Cloud API (order updates, COD, cart recovery, support) | 🟡 adapter | P0/P1 |
| Expo push (mobile) | ✅ | P0 |
| Notification center (bell feed) | 🟡 | P1 |
| AI support copilot (AR/EN, customer + agent-side) | 🔴 | P2 |

## Track 6 — Growth, SEO & Marketing
| Feature | Status | Priority |
|---|---|---|
| robots.txt + sitemap + JSON-LD (Product/Org/Breadcrumb) | ✅ live | P0 |
| hreflang ar-KW / en-KW | ✅ | P0 |
| Core Web Vitals (LCP<2.0s, INP<200, CLS<0.1) + Arabic font subsetting | 🟡 | P0 |
| Google Merchant + Meta catalog feeds | 🔴 | P1 |
| Meta Ads automation (audiences, dynamic retargeting) | 🔴 (tooling available) | P1 |
| Blog/HowTo installation guides (content SEO) | 🔴 | P2 |

## Track 7 — Platform, Infra & Integrations
| Feature | Status | Priority |
|---|---|---|
| Live web on Vercel + auto-deploy CI | ✅ | P0 |
| Live Supabase (schema, RLS, 2× security hardening) | ✅ | P0 |
| Full Shopify→Supabase catalog sync (all products/desc/galleries) | 🟡 script+CI ready | P0 |
| Custom domain (app.newtechq8.com) + TLS + canonical | 🔴 | P0 |
| Cloudflare front (CDN/WAF/Images/rate-limit) for Kuwait speed | 🔴 | P1 |
| Mobile EAS builds (customer/driver/technician) + store submission | 🔴 | P1 |
| Observability (logs, error tracking, uptime) | 🔴 | P1 |
| Zoho Books + Zoho Desk live connections | 🟡 | P1 |

---

## Phased execution
- **Phase A — Polish & go-live readiness (P0):** finish storefront redesign, checkout/payments production keys, full catalog sync, CWV/perf, custom domain. → *credible, fast, sellable store.*
- **Phase B — The moat (P1):** installation booking + field-service scheduler, WhatsApp commerce, reviews-with-media, bundles, BNPL, feeds + Meta Ads, Cloudflare, mobile EAS. → *differentiation no competitor matches.*
- **Phase C — Intelligence (P2):** AI search + recommendations + support copilot, smart dispatch/routing, demand forecasting, loyalty/referrals. → *efficiency + retention multiplier.*

**Next concrete steps I can execute now (no new keys):** finish redesign deploy, full catalog sync script run (needs Shopify+Supabase secrets), reviews schema+UI, WhatsApp templates, feeds generator, performance pass. **Needs your keys:** payment production keys, Shopify admin + Supabase service-role (for sync), custom domain DNS, Cloudflare auth.
