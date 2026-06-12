'use client';

import { useT } from '@/lib/use-t';

/**
 * OSALPHA bottom status bar — fixed integration-sync chips (Shopify / Zoho /
 * Yeastar) plus the open-shift indicator. Sticks to the viewport bottom; the
 * admin main content reserves space for it so nothing is hidden.
 */
export function AdminStatusBar() {
  const { locale } = useT();
  const ar = locale === 'ar';

  return (
    <div className="osa-statusbar fixed inset-x-0 bottom-0 z-[50] flex h-8 items-center gap-5 border-t border-osa-border bg-osa-surface px-7 text-[11.5px] text-osa-faint">
      <span className="flex items-center before:me-1.5 before:inline-block before:h-[7px] before:w-[7px] before:rounded-full before:bg-osa-green before:content-['']">
        {ar ? 'متصل' : 'Connected'}
      </span>
      <span>
        {ar ? 'مزامنة Shopify' : 'Shopify sync'} <span className="num">2m</span>
      </span>
      <span>
        Zoho Books <span className="num">5m</span>
      </span>
      <span>{ar ? 'بدالة Yeastar ✓' : 'Yeastar PBX ✓'}</span>
      <span className="ms-auto">
        {ar ? 'وردية المحل مفتوحة منذ' : 'Shop shift open since'} <span className="num">08:00</span>
        {ar ? ' · الكاشير: سارة' : ' · Cashier: Sara'}
      </span>
    </div>
  );
}
