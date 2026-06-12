'use client';

/**
 * OSALPHA product add/edit form — two-column layout.
 *
 * Main column: المعلومات الأساسية (name ar/en, description, brand, category,
 * slug), السعر والمخزون, المتغيّرات (mini-table + add), الصور (dropzone +
 * thumbnails reorder). Side column: الحالة, خيارات التركيب, معاينة سريعة (live
 * product-card preview). Sticky bottom save bar (إلغاء ghost + حفظ gold +
 * autosave hint). Validates on blur. Writes go through `saveProduct` with an
 * optimistic toast.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Category } from '@elite/types';
import { useT } from '@/lib/use-t';
import { localized } from '@/lib/i18n';
import type { CatalogProductDetail, CatalogVariant } from '@/lib/admin-catalog';
import { saveProduct, type ProductInput } from './actions';
import { Money, GoldButton, GhostButton, StatusToggle, kwd, int, useToast } from './shared';

const CARD = 'rounded-osa border border-osa-border bg-osa-surface shadow-osa p-[18px_20px]';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface FormState {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  brand: string;
  category_id: string;
  slug: string;
  is_active: boolean;
  requires_installation: boolean;
  installation_fee: number;
  warranty_months: number;
}

interface DraftVariant extends Pick<CatalogVariant, 'sku' | 'price' | 'sale_price'> {
  key: string;
  attributesText: string;
  onHand: number;
}

export function ProductForm({
  product,
  categories,
  live,
}: {
  product: CatalogProductDetail | null;
  categories: Category[];
  live: boolean;
}) {
  const { locale } = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const isEdit = !!product;

  const [form, setForm] = useState<FormState>({
    name_ar: product?.name_ar ?? '',
    name_en: product?.name_en ?? '',
    description_ar: product?.description_ar ?? '',
    description_en: product?.description_en ?? '',
    brand: product?.brand ?? '',
    category_id: product?.category_id ?? '',
    slug: product?.slug ?? '',
    is_active: product?.is_active ?? true,
    requires_installation: product?.requires_installation ?? false,
    installation_fee: product?.installation_fee ?? 0,
    warranty_months: product?.warranty_months ?? 12,
  });

  const [variants, setVariants] = useState<DraftVariant[]>(
    (product?.variants ?? []).map((v, i) => ({
      key: v.id || `v-${i}`,
      sku: v.sku,
      price: v.price,
      sale_price: v.sale_price,
      attributesText: Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', '),
      onHand: v.onHand,
    })),
  );

  const [images, setImages] = useState<string[]>(product?.media.map((m) => m.url) ?? []);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [touchedSlug, setTouchedSlug] = useState(isEdit);
  const [dragImg, setDragImg] = useState<number | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name_ar.trim()) next.name_ar = 'الاسم بالعربية مطلوب';
    if (!form.slug.trim()) next.slug = 'الرابط مطلوب';
    else if (!/^[a-z0-9؀-ۿ-]+$/.test(form.slug)) next.slug = 'رابط غير صالح';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function blurValidate(key: keyof FormState) {
    setErrors((e) => {
      const next = { ...e };
      if (key === 'name_ar') next.name_ar = form.name_ar.trim() ? undefined : 'الاسم بالعربية مطلوب';
      if (key === 'slug') next.slug = form.slug.trim() ? undefined : 'الرابط مطلوب';
      return next;
    });
  }

  // Cheapest variant drives the preview price.
  const cheapest = useMemo(() => {
    if (!variants.length) return { price: 0, sale_price: null as number | null };
    return variants.reduce((best, v) => ((v.sale_price ?? v.price) < (best.sale_price ?? best.price) ? v : best));
  }, [variants]);

  const totalStock = variants.reduce((n, v) => n + Math.max(0, v.onHand), 0);

  function onSubmit() {
    if (!validate()) {
      toast('يرجى تصحيح الحقول المطلوبة', { tone: 'error' });
      return;
    }
    const input: ProductInput = {
      ...(product ? { id: product.id } : {}),
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim(),
      description_ar: form.description_ar.trim() || null,
      description_en: form.description_en.trim() || null,
      brand: form.brand.trim() || null,
      category_id: form.category_id || null,
      slug: form.slug.trim(),
      is_active: form.is_active,
      requires_installation: form.requires_installation,
      installation_fee: Number(form.installation_fee) || 0,
      warranty_months: Number(form.warranty_months) || 0,
    };
    toast(isEdit ? 'جاري الحفظ…' : 'جاري الإنشاء…', { tone: 'info' });
    startTransition(async () => {
      const res = await saveProduct(input);
      if (res.ok) {
        toast(isEdit ? 'تم حفظ التغييرات' : 'تم إنشاء المنتج');
        router.push(`/${locale}/admin/catalog`);
        router.refresh();
      } else {
        toast(`تعذّر الحفظ: ${res.error ?? ''}`, { tone: 'error' });
      }
    });
  }

  function addVariant() {
    setVariants((vs) => [
      ...vs,
      { key: `new-${Date.now()}`, sku: '', price: 0, sale_price: null, attributesText: '', onHand: 0 },
    ]);
  }

  function updateVariant(key: string, patch: Partial<DraftVariant>) {
    setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  function removeVariant(key: string) {
    setVariants((vs) => vs.filter((v) => v.key !== key));
  }

  function onDropImages(files: FileList | null) {
    if (!files) return;
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setImages((imgs) => [...imgs, ...urls]);
  }

  function reorderImage(from: number, to: number) {
    setImages((imgs) => {
      const next = [...imgs];
      const [m] = next.splice(from, 1);
      if (m) next.splice(to, 0, m);
      return next;
    });
  }

  const previewName = locale === 'ar' ? form.name_ar || 'اسم المنتج' : form.name_en || form.name_ar || 'Product name';

  return (
    <div className="space-y-[14px] pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/catalog`)}
          className="grid h-9 w-9 place-items-center rounded-full border border-osa-border bg-osa-surface text-osa-muted transition-colors hover:bg-osa-surface-2"
          aria-label="رجوع"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {/* directional → mirror in RTL handled by start placement; arrow points to start */}
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-[22px] font-bold text-osa-ink">{isEdit ? 'تعديل المنتج' : 'منتج جديد'}</h1>
          {isEdit && <p className="num text-[12px] text-osa-faint">{product?.slug}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-[1fr_340px]">
        {/* ── Main column ── */}
        <div className="space-y-[14px]">
          {/* Basic info */}
          <section className={CARD}>
            <SectionTitle>المعلومات الأساسية</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="الاسم (عربي)" required error={errors.name_ar}>
                <input
                  dir="rtl"
                  value={form.name_ar}
                  onChange={(e) => {
                    set('name_ar', e.target.value);
                    if (!touchedSlug) set('slug', slugify(e.target.value));
                  }}
                  onBlur={() => blurValidate('name_ar')}
                  className={inputCls(!!errors.name_ar)}
                />
              </Field>
              <Field label="Name (English)">
                <input dir="ltr" value={form.name_en} onChange={(e) => set('name_en', e.target.value)} className={inputCls(false)} />
              </Field>
              <Field label="العلامة التجارية">
                <input value={form.brand} onChange={(e) => set('brand', e.target.value)} className={inputCls(false)} />
              </Field>
              <Field label="الفئة">
                <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className={inputCls(false)}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{localized(c, 'name', locale)}</option>
                  ))}
                </select>
              </Field>
              <Field label="الرابط (Slug)" required error={errors.slug} className="sm:col-span-2">
                <input
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => { setTouchedSlug(true); set('slug', e.target.value); }}
                  onBlur={() => blurValidate('slug')}
                  className={`num ${inputCls(!!errors.slug)}`}
                />
              </Field>
              <Field label="الوصف (عربي)" className="sm:col-span-2">
                <textarea
                  dir="rtl"
                  rows={4}
                  value={form.description_ar}
                  onChange={(e) => set('description_ar', e.target.value)}
                  className={inputCls(false) + ' resize-y leading-[1.7]'}
                />
              </Field>
            </div>
          </section>

          {/* Variants */}
          <section className={CARD}>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">المتغيّرات</SectionTitle>
              <button type="button" onClick={addVariant} className="rounded-full bg-osa-brand-dim px-[13px] py-[5px] text-[12px] font-semibold text-osa-brand transition-colors hover:border-osa-brand-border">
                + إضافة متغيّر
              </button>
            </div>
            {variants.length === 0 ? (
              <p className="py-4 text-center text-[12.5px] text-osa-faint">لا توجد متغيّرات — أضف الأول</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-osa-border">
                      <Th>SKU</Th>
                      <Th>الخصائص</Th>
                      <Th className="text-end">السعر</Th>
                      <Th className="text-end">التخفيض</Th>
                      <Th className="text-end">المخزون</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.key} className="border-b border-osa-border last:border-none">
                        <td className="py-2 pe-2">
                          <input value={v.sku ?? ''} onChange={(e) => updateVariant(v.key, { sku: e.target.value })} placeholder="SKU" className={`num ${miniInput}`} />
                        </td>
                        <td className="py-2 pe-2">
                          <input value={v.attributesText} onChange={(e) => updateVariant(v.key, { attributesText: e.target.value })} placeholder="اللون: أسود, المقاس: 65" className={miniInput} />
                        </td>
                        <td className="py-2 pe-2">
                          <input type="number" step="0.001" value={v.price} onChange={(e) => updateVariant(v.key, { price: Number(e.target.value) })} className={`num text-end ${miniInput}`} />
                        </td>
                        <td className="py-2 pe-2">
                          <input type="number" step="0.001" value={v.sale_price ?? ''} onChange={(e) => updateVariant(v.key, { sale_price: e.target.value ? Number(e.target.value) : null })} className={`num text-end ${miniInput}`} />
                        </td>
                        <td className="py-2 pe-2">
                          <input type="number" value={v.onHand} onChange={(e) => updateVariant(v.key, { onHand: Number(e.target.value) })} className={`num text-end ${miniInput}`} />
                        </td>
                        <td className="py-2 text-end">
                          <button type="button" onClick={() => removeVariant(v.key)} className="text-osa-rose" aria-label="حذف">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11.5px] text-osa-faint">إجمالي المخزون: <span className="num font-semibold text-osa-ink">{int(totalStock)}</span></p>
          </section>

          {/* Images */}
          <section className={CARD}>
            <SectionTitle>الصور</SectionTitle>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); onDropImages(e.dataTransfer.files); }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-osa-sm border-2 border-dashed border-osa-border-strong bg-osa-surface-2 px-4 py-8 text-center transition-colors hover:border-osa-brand-border"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-osa-faint" aria-hidden>
                <path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-semibold text-osa-ink">اسحب الصور هنا أو اضغط للرفع</span>
              <span className="text-[11.5px] text-osa-faint">PNG · JPG · WebP حتى 5MB</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onDropImages(e.target.files)} />
            </label>
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    draggable
                    onDragStart={() => setDragImg(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragImg != null) reorderImage(dragImg, i); setDragImg(null); }}
                    className="group relative h-20 w-20 cursor-grab overflow-hidden rounded-osa-sm border border-osa-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-osa-brand/90 py-px text-center text-[9px] font-semibold text-white">رئيسية</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                      className="absolute top-1 end-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="حذف الصورة"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Side column ── */}
        <div className="space-y-[14px]">
          {/* Status */}
          <section className={CARD}>
            <SectionTitle>الحالة</SectionTitle>
            <StatusToggle active={form.is_active} onChange={(next) => set('is_active', next)} />
            <p className="mt-2 text-[11.5px] text-osa-faint">
              {form.is_active ? 'المنتج مرئي في المتجر.' : 'المنتج مخفي عن العملاء.'}
            </p>
          </section>

          {/* Installation options */}
          <section className={CARD}>
            <SectionTitle>خيارات التركيب</SectionTitle>
            <label className="flex items-center gap-2.5 text-[13px] text-osa-ink">
              <input
                type="checkbox"
                checked={form.requires_installation}
                onChange={(e) => set('requires_installation', e.target.checked)}
                className="h-4 w-4 accent-osa-brand"
              />
              يتطلّب تركيباً
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {form.requires_installation && (
                <Field label="رسوم التركيب (د.ك)">
                  <input type="number" step="0.001" value={form.installation_fee} onChange={(e) => set('installation_fee', Number(e.target.value))} className={`num ${inputCls(false)}`} />
                </Field>
              )}
              <Field label="الضمان (أشهر)" className={form.requires_installation ? '' : 'col-span-2'}>
                <input type="number" value={form.warranty_months} onChange={(e) => set('warranty_months', Number(e.target.value))} className={`num ${inputCls(false)}`} />
              </Field>
            </div>
          </section>

          {/* Live preview */}
          <section className={CARD}>
            <SectionTitle>معاينة سريعة</SectionTitle>
            <div className="overflow-hidden rounded-osa border border-osa-border bg-osa-surface">
              <div className="grid aspect-[4/3] place-items-center bg-osa-surface-2">
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-osa-faint text-[12px]">لا توجد صورة</span>
                )}
              </div>
              <div className="p-3">
                {form.brand && <div className="text-[11px] text-osa-faint">{form.brand}</div>}
                <div className="line-clamp-2 text-[13px] font-medium text-osa-ink">{previewName}</div>
                <div className="mt-1.5">
                  <Money price={cheapest.price} salePrice={cheapest.sale_price} align="start" />
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  {form.requires_installation && (
                    <span className="rounded-full bg-osa-brand-dim px-2 py-px font-semibold text-osa-brand">
                      تركيب <span className="num">{kwd(form.installation_fee)}</span> د.ك
                    </span>
                  )}
                  {!form.is_active && <span className="rounded-full bg-osa-surface-2 px-2 py-px font-semibold text-osa-muted">مخفي</span>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-osa-border bg-osa-surface/95 backdrop-blur lg:ms-[240px]">
        <div className="mx-auto flex max-w-[1380px] items-center gap-3 px-7 py-3">
          <span className="text-[11.5px] text-osa-faint">
            {live ? 'يُحفظ في قاعدة البيانات.' : 'وضع تجريبي — التغييرات غير محفوظة.'}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <GhostButton onClick={() => router.push(`/${locale}/admin/catalog`)}>إلغاء</GhostButton>
            <GoldButton onClick={onSubmit}>{isEdit ? 'حفظ التغييرات' : 'إنشاء المنتج'}</GoldButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field primitives ────────────────────────────────────────

const inputBase =
  'w-full rounded-osa-sm border bg-osa-surface px-3 py-[9px] text-[13px] text-osa-ink placeholder:text-osa-faint focus:outline-none focus:ring-2 focus:ring-osa-brand-border';
const miniInput =
  'w-full rounded-md border border-osa-border bg-osa-surface px-2 py-[5px] text-[12px] text-osa-ink focus:border-osa-brand-border focus:outline-none';

function inputCls(error: boolean): string {
  return `${inputBase} ${error ? 'border-osa-rose' : 'border-osa-border focus:border-osa-brand-border'}`;
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mb-3 text-[14.5px] font-bold text-osa-ink ${className}`}>{children}</h2>;
}

function Field({
  label,
  children,
  required,
  error,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-osa-muted">
        {label}
        {required && <span className="ms-1 text-osa-rose">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11.5px] text-osa-rose">{error}</p>}
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-1 pb-2 text-start text-[11px] font-semibold text-osa-faint ${className}`}>{children}</th>;
}
