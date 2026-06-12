/**
 * OSALPHA analytics sample data — mirrors /tmp/themes/analytics_gold.html with
 * realistic Newtech-Kuwait content. Used when the live client/env is absent or
 * the backing RPC returns nothing. Money is KWD (3 decimals). Several blocks
 * (visitors, conversion, channel split, customers, payment methods, traffic
 * sources) have NO backing RPC in the @elite/core contract yet and are
 * sample-only — clearly marked in `admin-analytics.ts`.
 */

export interface AnalyticsKpi {
  label: string;
  value: number;
  /** 3-decimal KWD money vs an integer/percent metric. */
  kind: 'money' | 'int' | 'percent';
  deltaPct: number;
}

export interface ChannelSlice {
  label: string;
  pct: number;
  color: string;
}

export interface TopProductRow {
  emoji: string;
  name: string;
  units: number;
  revenue: number;
  stock: string;
}

export interface BarRow {
  name: string;
  value: number;
  /** Display value (already formatted) when different from `value`. */
  display?: string;
  /** 0–100 bar width. */
  pct: number;
}

export interface CustomersBlock {
  fresh: number;
  returning: number;
  returnRatePct: number;
}

export interface AnalyticsSample {
  kpis: AnalyticsKpi[];
  /** Current-period sales series (for the area chart). */
  salesSeries: number[];
  /** Previous-period sales series (dashed comparison line). */
  prevSeries: number[];
  channels: ChannelSlice[];
  topProducts: TopProductRow[];
  byRegion: BarRow[];
  customers: CustomersBlock;
  paymentMethods: BarRow[];
  trafficSources: BarRow[];
}

export const analyticsSample: AnalyticsSample = {
  kpis: [
    { label: 'إجمالي المبيعات', value: 128450.75, kind: 'money', deltaPct: 14.2 },
    { label: 'الطلبات', value: 1284, kind: 'int', deltaPct: 9.6 },
    { label: 'متوسط قيمة الطلب', value: 100.04, kind: 'money', deltaPct: 4.1 },
    { label: 'معدّل التحويل', value: 3.8, kind: 'percent', deltaPct: 0.4 },
    { label: 'الزوّار', value: 33800, kind: 'int', deltaPct: -2.1 },
  ],
  salesSeries: [120, 132, 128, 145, 138, 162, 150, 176, 168, 190, 182, 205],
  prevSeries: [108, 116, 112, 124, 120, 138, 132, 150, 144, 162, 158, 172],
  channels: [
    { label: 'المتجر الإلكتروني', pct: 52, color: 'var(--osa-brand)' },
    { label: 'الكاشير (POS)', pct: 22, color: 'var(--osa-aqua)' },
    { label: 'واتساب', pct: 15, color: 'var(--osa-blue)' },
    { label: 'الورشة', pct: 11, color: 'var(--osa-amber)' },
  ],
  topProducts: [
    { emoji: '📷', name: 'داش كام أزدوم PG17 Max', units: 189, revenue: 4851.5, stock: '42 متوفّر' },
    { emoji: '🔒', name: 'قفل ذكي S630', units: 164, revenue: 3520.0, stock: '18 متوفّر' },
    { emoji: '🛡️', name: 'حماية PPF كاملة', units: 121, revenue: 3150.0, stock: 'خدمة' },
    { emoji: '📽️', name: 'بروجكتر فريستايل', units: 98, revenue: 2340.0, stock: '7 متوفّر' },
  ],
  byRegion: [
    { name: 'السالمية', value: 28400, pct: 88 },
    { name: 'حولي', value: 23100, pct: 72 },
    { name: 'الجابرية', value: 19200, pct: 60 },
    { name: 'الفروانية', value: 14800, pct: 46 },
    { name: 'الأحمدي', value: 10900, pct: 34 },
  ],
  customers: { fresh: 412, returning: 872, returnRatePct: 68 },
  paymentMethods: [
    { name: 'KNET', value: 64, display: '64%', pct: 64 },
    { name: 'Apple Pay', value: 18, display: '18%', pct: 18 },
    { name: 'تابي/تمارا', value: 11, display: '11%', pct: 11 },
    { name: 'COD', value: 7, display: '7%', pct: 7 },
  ],
  trafficSources: [
    { name: 'إنستغرام', value: 40, display: '40%', pct: 40 },
    { name: 'بحث Google', value: 26, display: '26%', pct: 26 },
    { name: 'مباشر', value: 20, display: '20%', pct: 20 },
    { name: 'سناب/تيك توك', value: 14, display: '14%', pct: 14 },
  ],
};
