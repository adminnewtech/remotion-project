/**
 * OSALPHA overview sample data — mirrors the gold reference mockup. Used when
 * the live Supabase client/env is absent so the dashboard always renders with
 * realistic Newtech-Kuwait content (no Lorem Ipsum). Money is KWD (3 decimals).
 */

export interface OverviewKpis {
  /** Today's sales (KWD). */
  salesToday: number;
  /** Delta vs the Friday average, percent. */
  salesDeltaPct: number;
  /** Orders placed today + per-channel split. */
  ordersToday: number;
  channelSplit: { cashier: number; store: number; whatsapp: number; workshop: number };
  /** Reconciled shift cash (KWD). */
  shiftCash: number;
  /** Outstanding receivables (KWD) + customers past 30 days. */
  receivables: number;
  overdueCustomers: number;
}

export interface ChannelSeries {
  store: number[];
  cashier: number[];
  whatsapp: number[];
}

export interface OverviewProduct {
  emoji: string;
  name: string;
  meta: string;
  revenue: number;
  /** 0–100 share bar. */
  share: number;
}

export interface OverviewOrder {
  number: string;
  customer: string;
  channel: string;
  pay: string;
  total: number;
  status: 'new' | 'prep' | 'done' | 'late';
}

export interface WorkshopBay {
  plate: string;
  service: string;
  eta: string;
  progress: number;
}

export interface OverviewTask {
  id: string;
  label: string;
  who: string;
  done: boolean;
}

export const overviewKpis: OverviewKpis = {
  salesToday: 4250.5,
  salesDeltaPct: 18,
  ordersToday: 38,
  channelSplit: { cashier: 16, store: 11, whatsapp: 7, workshop: 4 },
  shiftCash: 1180.25,
  receivables: 32601.991,
  overdueCustomers: 7,
};

export const overviewChannelSeries: ChannelSeries = {
  store: [42, 55, 70, 64, 88, 95, 110, 102, 124, 118, 140, 150],
  cashier: [30, 38, 52, 46, 64, 70, 78, 84, 96, 92, 105, 118],
  whatsapp: [18, 24, 28, 26, 40, 44, 52, 58, 60, 64, 70, 72],
};

export const overviewTopProducts: OverviewProduct[] = [
  { emoji: '📷', name: 'داش كام أزدوم PG17 Max', meta: '89 قطعة هذا الشهر', revenue: 4851.5, share: 92 },
  { emoji: '🔒', name: 'قفل ذكي S630', meta: '64 قطعة', revenue: 3520.0, share: 68 },
  { emoji: '🛡️', name: 'حماية PPF كاملة', meta: '21 سيارة', revenue: 3150.0, share: 60 },
  { emoji: '📽️', name: 'بروجكتر سامسونج فريستايل', meta: '18 قطعة', revenue: 2340.0, share: 45 },
];

export const overviewOrders: OverviewOrder[] = [
  { number: '#8424', customer: 'عبدالله العنزي', channel: 'المتجر', pay: 'KNET', total: 64.5, status: 'new' },
  { number: '#8423', customer: 'سارة المطيري', channel: 'واتساب', pay: 'رابط دفع', total: 129.0, status: 'prep' },
  { number: '#8422', customer: 'فهد الديحاني', channel: 'الكاشير', pay: 'كاش', total: 38.75, status: 'done' },
  { number: '#8421', customer: 'نورة العجمي', channel: 'المتجر', pay: 'تابي ×4', total: 216.0, status: 'prep' },
  { number: '#8420', customer: 'يوسف الكندري', channel: 'المتجر', pay: 'COD', total: 54.5, status: 'late' },
];

export const overviewBays: WorkshopBay[] = [
  { plate: '12345 KWT', service: 'حماية PPF كاملة', eta: 'يتبقى 2:40 س', progress: 65 },
  { plate: '7811 ABC', service: 'تظليل حراري 70%', eta: 'يتبقى 0:50 س', progress: 85 },
  { plate: '9302 KWS', service: 'نانو سيراميك', eta: 'بدأ الآن', progress: 12 },
];

export const overviewTasks: OverviewTask[] = [
  { id: 't1', label: 'مطابقة كاش وردية الصباح', who: 'سارة', done: true },
  { id: 't2', label: 'رد على شكاوى الواتساب', who: 'منى', done: true },
  { id: 't3', label: 'اعتماد أمر شراء فيلم PPF-200', who: 'أنت', done: false },
  { id: 't4', label: 'متابعة الطلبات المتأخرة (4)', who: 'خالد', done: false },
];

export const overviewBrief = {
  ar: {
    text: 'مساعدك يقول: المبيعات أعلى من متوسط الجمعة بـ',
    deltaPct: 18,
    mid: '. عندك',
    late: '4 طلبات متأخرة',
    tail: 'عن التوصيل، وفيلم',
    sku: 'PPF-200',
    tail2: 'بينفد خلال 3 أيام.',
    chips: ['عرض المتأخرات', 'إنشاء أمر شراء', 'التقرير الكامل'],
  },
};
