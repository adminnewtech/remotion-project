import 'server-only';

/**
 * Admin settings data seam (OSALPHA gold) — first-party store configuration.
 *
 * Reads the singleton `app_settings` row + `delivery_zones` so the business is
 * run from our own admin (not Shopify/Zid settings). Sample fallback keeps the
 * page rendering with no env. Money is KWD.
 */
import { getServerClient } from '@/lib/supabase/server';

export interface StoreSettings {
  store_name_ar: string;
  store_name_en: string;
  support_phone: string | null;
  support_email: string | null;
  whatsapp_number: string | null;
  currency: string;
  free_delivery_threshold: number;
  default_delivery_fee: number;
  default_installation_fee: number;
  payments: { knet: boolean; cod: boolean; apple_pay: boolean; google_pay: boolean };
  notifications: { push: boolean; email: boolean; whatsapp: boolean; sms: boolean };
}

export interface DeliveryZone {
  id: string;
  governorate: string;
  area: string | null;
  fee: number;
  eta_hours: number;
  is_active: boolean;
  sort: number;
}

export interface SettingsData {
  live: boolean;
  settings: StoreSettings;
  zones: DeliveryZone[];
}

const DEFAULTS: StoreSettings = {
  store_name_ar: 'نيوتك',
  store_name_en: 'Newtech',
  support_phone: '+965 1880 800',
  support_email: 'store@newtechkw.com',
  whatsapp_number: '+965 5000 0000',
  currency: 'KWD',
  free_delivery_threshold: 10,
  default_delivery_fee: 2,
  default_installation_fee: 5,
  payments: { knet: true, cod: true, apple_pay: false, google_pay: false },
  notifications: { push: true, email: true, whatsapp: true, sms: false },
};

const SAMPLE_ZONES: DeliveryZone[] = [
  { id: 'z1', governorate: 'العاصمة', area: null, fee: 2, eta_hours: 24, is_active: true, sort: 1 },
  { id: 'z2', governorate: 'حولي', area: null, fee: 2, eta_hours: 24, is_active: true, sort: 2 },
  { id: 'z3', governorate: 'الفروانية', area: null, fee: 2, eta_hours: 24, is_active: true, sort: 3 },
  { id: 'z4', governorate: 'الأحمدي', area: null, fee: 2.5, eta_hours: 48, is_active: true, sort: 4 },
  { id: 'z5', governorate: 'الجهراء', area: null, fee: 3, eta_hours: 48, is_active: true, sort: 5 },
  { id: 'z6', governorate: 'مبارك الكبير', area: null, fee: 2, eta_hours: 24, is_active: true, sort: 6 },
];

export async function fetchSettings(): Promise<SettingsData> {
  const client = await getServerClient();
  if (client) {
    try {
      const [{ data: s }, { data: zones }] = await Promise.all([
        client.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        client.from('delivery_zones').select('*').order('sort', { ascending: true }),
      ]);
      if (s) {
        const row = s as Record<string, unknown>;
        return {
          live: true,
          settings: {
            store_name_ar: (row.store_name_ar as string) ?? DEFAULTS.store_name_ar,
            store_name_en: (row.store_name_en as string) ?? DEFAULTS.store_name_en,
            support_phone: (row.support_phone as string) ?? null,
            support_email: (row.support_email as string) ?? null,
            whatsapp_number: (row.whatsapp_number as string) ?? null,
            currency: (row.currency as string) ?? 'KWD',
            free_delivery_threshold: Number(row.free_delivery_threshold ?? DEFAULTS.free_delivery_threshold),
            default_delivery_fee: Number(row.default_delivery_fee ?? DEFAULTS.default_delivery_fee),
            default_installation_fee: Number(row.default_installation_fee ?? DEFAULTS.default_installation_fee),
            payments: { ...DEFAULTS.payments, ...(row.payments as object) },
            notifications: { ...DEFAULTS.notifications, ...(row.notifications as object) },
          },
          zones: ((zones ?? []) as DeliveryZone[]).map((z) => ({ ...z, fee: Number(z.fee), eta_hours: Number(z.eta_hours) })),
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { live: false, settings: DEFAULTS, zones: SAMPLE_ZONES };
}
