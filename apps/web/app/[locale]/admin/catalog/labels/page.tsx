'use client';

import { useState, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantOption {
  variantId: string;
  productName: string;
  sku: string;
  price: number;
  barcode: string | null;
}

interface SelectedVariant extends VariantOption {
  qty: number;
}

// ── Sample data (used when no live search is wired) ──────────────────────────

const SAMPLE_VARIANTS: VariantOption[] = [
  { variantId: 'v1', productName: 'تلفزيون سامسونج QLED 4K', sku: 'SAM-65Q-BLK', price: 249.0, barcode: '6291001234561' },
  { variantId: 'v2', productName: 'مكيف سبليت إل جي 18000', sku: 'LG-AC-18K', price: 199.0, barcode: '6291001234578' },
  { variantId: 'v3', productName: 'غسالة بوش 9 كجم', sku: 'BSH-9KG-WHT', price: 139.5, barcode: '6291001234585' },
  { variantId: 'v4', productName: 'مكبر صوت سوني HT-A5000', sku: 'SON-HTA5', price: 119.0, barcode: '6291001234592' },
  { variantId: 'v5', productName: 'لابتوب ماك بوك اير M3', sku: 'APL-MBA-256', price: 379.0, barcode: '6291001234609' },
];

// ── Barcode canvas helper ────────────────────────────────────────────────────

function BarcodeCanvas({
  value,
  width,
  height,
}: {
  value: string;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const renderBarcode = useCallback(
    async (canvas: HTMLCanvasElement) => {
      try {
        const bwipjs = await import('bwip-js');
        bwipjs.toCanvas(canvas, {
          bcid: 'code128',
          text: value,
          scale: 2,
          height: height,
          width: width,
          includetext: false,
          backgroundcolor: 'ffffff',
        });
        setImgSrc(canvas.toDataURL('image/png'));
      } catch {
        setError(true);
      }
    },
    [value, width, height],
  );

  const setCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas;
      if (canvas) renderBarcode(canvas);
    },
    [renderBarcode],
  );

  if (error) {
    return (
      <div
        className="flex items-center justify-center border border-dashed border-neutral-300 bg-neutral-50 font-mono text-[8px] text-neutral-400"
        style={{ width, height: height * 4 }}
      >
        {value}
      </div>
    );
  }

  if (imgSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imgSrc} alt={`barcode-${value}`} style={{ width, height: height * 4 }} />;
  }

  return (
    <canvas
      ref={setCanvasRef}
      style={{ display: 'none' }}
    />
  );
}

// ── Label component (38×25mm at 96dpi ≈ 144×95px) ───────────────────────────

function Label({ variant }: { variant: VariantOption }) {
  const barcodeValue = variant.barcode ?? variant.sku;

  return (
    <div
      className="flex flex-col items-center justify-between overflow-hidden rounded border border-neutral-300 bg-white p-1"
      style={{ width: 144, height: 95, pageBreakInside: 'avoid' }}
    >
      <BarcodeCanvas value={barcodeValue} width={120} height={10} />
      <p className="mt-0.5 w-full truncate text-center font-mono text-[7px] text-neutral-600">
        {barcodeValue}
      </p>
      <p
        className="w-full truncate text-center text-[7.5px] font-semibold leading-tight text-neutral-800"
        style={{ direction: 'rtl' }}
      >
        {variant.productName}
      </p>
      <p className="text-[8px] font-bold text-neutral-900">
        {variant.price.toFixed(3)} د.ك
      </p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function LabelPrintingPage() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedVariant[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const filtered = query.trim()
    ? SAMPLE_VARIANTS.filter(
        (v) =>
          v.productName.includes(query) ||
          v.sku.toLowerCase().includes(query.toLowerCase()) ||
          (v.barcode ?? '').includes(query),
      )
    : SAMPLE_VARIANTS;

  function addVariant(v: VariantOption) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.variantId === v.variantId);
      if (exists) return prev;
      return [...prev, { ...v, qty: 1 }];
    });
  }

  function updateQty(variantId: string, qty: number) {
    setSelected((prev) =>
      prev.map((s) => (s.variantId === variantId ? { ...s, qty: Math.max(1, qty) } : s)),
    );
  }

  function removeVariant(variantId: string) {
    setSelected((prev) => prev.filter((s) => s.variantId !== variantId));
  }

  function handlePrint() {
    window.print();
  }

  const totalLabels = selected.reduce((s, v) => s + v.qty, 0);

  // Build flat label list for preview
  const labelList: VariantOption[] = selected.flatMap((s) =>
    Array.from({ length: s.qty }, () => s as VariantOption),
  );

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-osa-text">طباعة الملصقات</h1>
          <p className="text-sm text-osa-text/60">Label Printing — 38×25mm Code-128</p>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="rounded-lg border border-osa-border px-4 py-2 text-sm font-medium text-osa-text transition-colors hover:bg-osa-surface/80"
            >
              معاينة ({totalLabels} ملصق)
            </button>
            <button
              onClick={handlePrint}
              className="rounded-lg bg-osa-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              طباعة مباشرة
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Variant selector */}
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-osa-text">اختيار المنتجات</h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو SKU أو الباركود..."
            className="mb-3 w-full rounded-lg border border-osa-border bg-white px-3 py-2 text-sm text-osa-text placeholder:text-osa-text/40 focus:outline-none focus:ring-2 focus:ring-osa-primary/30"
          />
          <div className="max-h-72 divide-y divide-osa-border overflow-y-auto rounded-lg border border-osa-border">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-osa-text/40">لا توجد نتائج</p>
            )}
            {filtered.map((v) => {
              const isAdded = selected.some((s) => s.variantId === v.variantId);
              return (
                <div
                  key={v.variantId}
                  className={`flex items-center justify-between px-3 py-2.5 transition-colors ${
                    isAdded ? 'bg-osa-primary/5' : 'hover:bg-osa-surface/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-osa-text">{v.productName}</p>
                    <p className="font-mono text-xs text-osa-text/60">
                      {v.sku} · {v.price.toFixed(3)} د.ك
                    </p>
                  </div>
                  <button
                    onClick={() => addVariant(v)}
                    disabled={isAdded}
                    className={`ms-3 flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isAdded
                        ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
                        : 'bg-osa-primary text-white hover:opacity-90'
                    }`}
                  >
                    {isAdded ? 'مضاف' : '+ إضافة'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected list */}
        <div className="rounded-xl border border-osa-border bg-osa-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-osa-text">
            المنتجات المحددة
            {selected.length > 0 && (
              <span className="ms-2 rounded-full bg-osa-primary/10 px-2 py-0.5 text-xs font-semibold text-osa-primary">
                {selected.length}
              </span>
            )}
          </h2>
          {selected.length === 0 && (
            <p className="py-8 text-center text-sm text-osa-text/40">
              اختر منتجات من القائمة اليسرى
            </p>
          )}
          <div className="space-y-2">
            {selected.map((s) => (
              <div
                key={s.variantId}
                className="flex items-center gap-3 rounded-lg border border-osa-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-osa-text">{s.productName}</p>
                  <p className="font-mono text-xs text-osa-text/60">{s.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-osa-text/60">الكمية</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={s.qty}
                    onChange={(e) => updateQty(s.variantId, parseInt(e.target.value, 10) || 1)}
                    className="w-16 rounded border border-osa-border px-2 py-1 text-center text-sm text-osa-text focus:outline-none focus:ring-2 focus:ring-osa-primary/30"
                  />
                </div>
                <button
                  onClick={() => removeVariant(s.variantId)}
                  className="text-red-400 transition-colors hover:text-red-600"
                  aria-label="حذف"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-800">
                معاينة الملصقات ({totalLabels} ملصق)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="rounded-lg bg-osa-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                >
                  طباعة
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  إغلاق
                </button>
              </div>
            </div>
            {/* Labels grid — 3 per row, 38×25mm */}
            <div
              id="print-labels"
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(3, 144px)', justifyContent: 'start' }}
            >
              {labelList.map((v, i) => (
                <Label key={`${v.variantId}-${i}`} variant={v} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-labels, #print-labels * { visibility: visible !important; }
          #print-labels {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            display: grid !important;
            grid-template-columns: repeat(3, 144px) !important;
            gap: 4px !important;
            padding: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
