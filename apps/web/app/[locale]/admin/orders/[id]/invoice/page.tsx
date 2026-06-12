import { fetchAdminOrder } from '@/lib/admin-orders';
import { fetchSettings } from '@/lib/admin-settings';

export const dynamic = 'force-dynamic';

type DocType = 'invoice' | 'packing' | 'quote';

const TITLES: Record<DocType, string> = {
  invoice: 'فاتورة ضريبية مبسطة',
  packing: 'بوليصة تجهيز',
  quote: 'عرض سعر',
};

/** Printable invoice / packing slip / quote for an order (A4, auto-print). */
export default async function OrderDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const doc: DocType = type === 'packing' ? 'packing' : type === 'quote' ? 'quote' : 'invoice';
  const [data, settings] = await Promise.all([fetchAdminOrder(id), fetchSettings()]);
  if (!data) return <p style={{ padding: 40 }}>الطلب غير موجود</p>;
  const d = data.detail;
  const s = settings.settings;
  const showPrices = doc !== 'packing';

  return (
    <html dir="rtl" lang="ar">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, color: '#0f172a', background: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #b8860b', paddingBottom: 14, marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22 }}>{s.store_name_ar}</h1>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                {s.support_phone ?? ''}{s.support_email ? ` · ${s.support_email}` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ margin: 0, fontSize: 17, color: '#b8860b' }}>{TITLES[doc]}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700 }}>{d.number}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#64748b' }}>{d.placedAt.slice(0, 10)}</p>
            </div>
          </header>

          <section style={{ display: 'flex', gap: 24, fontSize: 13, marginBottom: 16 }}>
            <div>
              <strong>العميل:</strong> {d.customer}
              <span style={{ color: '#64748b' }}> · {d.phone}</span>
            </div>
            <div><strong>العنوان:</strong> {d.address.governorate} · {d.address.area}</div>
          </section>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>المنتج</th>
                <th style={th}>الكمية</th>
                {showPrices && <th style={th}>السعر</th>}
                {showPrices && <th style={th}>الإجمالي</th>}
                {!showPrices && <th style={th}>تم التجهيز ☐</th>}
              </tr>
            </thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.id}>
                  <td style={td}>{it.name}{it.withInstallation ? ' (مع التركيب)' : ''}<br /><small style={{ color: '#94a3b8' }}>{it.sku ?? ''}</small></td>
                  <td style={td}>{it.qty}</td>
                  {showPrices && <td style={td}>{it.unitPrice.toFixed(3)}</td>}
                  {showPrices && <td style={{ ...td, fontWeight: 700 }}>{it.lineTotal.toFixed(3)}</td>}
                  {!showPrices && <td style={{ ...td, fontSize: 18 }}>☐</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {showPrices && (
            <div style={{ marginTop: 14, marginRight: 'auto', width: 260, fontSize: 13 }}>
              <Row l="المجموع الفرعي" v={d.subtotal} />
              <Row l="التوصيل" v={d.deliveryFee} />
              <Row l="التركيب" v={d.installationFee} />
              {d.discountTotal > 0 && <Row l="الخصم" v={-d.discountTotal} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', marginTop: 6, paddingTop: 6, fontWeight: 800, fontSize: 15 }}>
                <span>الإجمالي</span><span>{d.total.toFixed(3)} د.ك</span>
              </div>
            </div>
          )}

          <footer style={{ marginTop: 28, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: 11.5, color: '#64748b' }}>
            {doc === 'quote'
              ? 'عرض السعر ساري لمدة 7 أيام من تاريخه · الأسعار بالدينار الكويتي شاملة.'
              : doc === 'packing'
                ? 'تُرفق هذه البوليصة مع الشحنة — يرجى مطابقة الأصناف قبل التسليم.'
                : `شكراً لتسوقكم من ${s.store_name_ar} · للاستفسار: ${s.support_phone ?? ''}`}
          </footer>
        </div>
        <script dangerouslySetInnerHTML={{ __html: 'window.onload=()=>setTimeout(()=>window.print(),300);' }} />
      </body>
    </html>
  );
}

const th: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', borderBottom: '1.5px solid #e2e8f0', fontSize: 11.5, color: '#64748b' };
const td: React.CSSProperties = { padding: '9px 10px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

function Row({ l, v }: { l: string; v: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: '#64748b' }}>{l}</span><span>{v.toFixed(3)}</span>
    </div>
  );
}
