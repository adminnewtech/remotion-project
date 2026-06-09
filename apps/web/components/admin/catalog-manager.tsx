'use client';

import { useState } from 'react';
import type { Category, Product } from '@elite/types';
import { Table, Badge, Button, Input, Select, Modal, StatusBadge } from '@elite/ui/web';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import { PageHeader } from '@/components/admin/ui';
import { sampleVariants } from '@/lib/sample-data';

/**
 * Catalog & inventory management. Product list with stock, a create/edit
 * product form (incl. "requires installation" + fee + warranty), and a
 * per-product variant editor. Writes would call core/admin mutations.
 */
export function CatalogManager({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);

  return (
    <div>
      <PageHeader
        title={t('nav.catalog')}
        subtitle={t('nav.inventory')}
        actions={<Button onClick={() => setCreating(true)}>+ {t('nav.products')}</Button>}
      />

      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <Table>
          <thead>
            <tr>
              <th>{t('nav.products')}</th>
              <th>{t('product.brand')}</th>
              <th>{t('product.buyAndInstall')}</th>
              <th>{t('nav.inventory')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = 4 + (p.id.charCodeAt(p.id.length - 1) % 20);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{localized(p, 'name', locale)}</td>
                  <td className="text-muted">{p.brand}</td>
                  <td>{p.requires_installation ? <Badge variant="accent">{p.installation_fee} KWD</Badge> : <span className="text-muted">—</span>}</td>
                  <td>
                    {stock <= 5 ? (
                      <StatusBadge status="failed" labelOverride={t('product.lowStock', { count: stock })} />
                    ) : (
                      <span className="text-sm font-medium">{stock}</span>
                    )}
                  </td>
                  <td className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setVariantsFor(p)}>{t('product.selectVariant')}</Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(p)}>{t('common.edit')}</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {/* Create / edit product form */}
      <ProductForm
        open={creating || !!editing}
        product={editing}
        categories={categories}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      {/* Variant editor */}
      <Modal open={!!variantsFor} onClose={() => setVariantsFor(null)} title={`${t('product.selectVariant')} — ${variantsFor ? localized(variantsFor, 'name', locale) : ''}`}>
        {variantsFor && (
          <div className="space-y-3">
            {sampleVariants(variantsFor.id).map((v) => (
              <div key={v.id} className="grid grid-cols-4 items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <span className="font-mono text-xs">{v.sku}</span>
                <span>{Object.values(v.attributes).join(' / ')}</span>
                <span className="font-semibold">{v.sale_price ?? v.price} KWD</span>
                <Button variant="ghost" size="sm" className="justify-self-end">{t('common.edit')}</Button>
              </div>
            ))}
            <Button variant="outline" className="w-full">+ {t('product.selectVariant')}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProductForm({
  open,
  product,
  categories,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const [requiresInstall, setRequiresInstall] = useState(product?.requires_installation ?? false);

  return (
    <Modal open={open} onClose={onClose} title={product ? t('common.edit') : t('nav.products')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="الاسم (AR)" defaultValue={product?.name_ar} dir="rtl" />
          <Input label="Name (EN)" defaultValue={product?.name_en} />
          <Input label={t('product.brand')} defaultValue={product?.brand ?? ''} />
          <Select label={t('catalog.filterCategory')} defaultValue={product?.category_id ?? ''}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{localized(c, 'name', locale)}</option>
            ))}
          </Select>
          <Input label="Slug" defaultValue={product?.slug} className="col-span-2" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresInstall} onChange={(e) => setRequiresInstall(e.target.checked)} className="accent-primary" />
          {t('product.buyAndInstall')}
        </label>

        <div className="grid grid-cols-2 gap-3">
          {requiresInstall && <Input label={t('product.installationFee')} type="number" defaultValue={product?.installation_fee ?? 0} />}
          <Input label={locale === 'ar' ? 'الضمان (أشهر)' : 'Warranty (months)'} type="number" defaultValue={product?.warranty_months ?? 12} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit">{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
