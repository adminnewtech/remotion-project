import { coerceLocale } from '@/lib/i18n';
import { fetchInventory } from '@/lib/admin-catalog';
import { InventoryView } from '@/components/admin/catalog/inventory-view';
import { CatalogToastProvider } from '@/components/admin/catalog/shared';

/** OSALPHA inventory view — per-variant stock with inline quick-adjust. */
export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  coerceLocale(raw);
  const data = await fetchInventory();
  return (
    <CatalogToastProvider>
      <InventoryView data={data} />
    </CatalogToastProvider>
  );
}
