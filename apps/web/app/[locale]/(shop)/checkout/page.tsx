'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { PaymentMethod } from '@elite/types';
import { Button, Input, Select } from '@elite/ui/web';
import { orders as coreOrders, cart as coreCart } from '@elite/core';
import { useCart } from '@/components/cart-store';
import { useSupabase } from '@/components/providers';
import { useT } from '@/lib/use-t';
import { OrderSummary } from '@/components/order-summary';

const GOVERNORATES = ['Al Asimah', 'Hawalli', 'Farwaniya', 'Ahmadi', 'Jahra', 'Mubarak Al-Kabeer'];

const SLOTS = [
  { id: 's1', start: '09:00', end: '12:00' },
  { id: 's2', start: '12:00', end: '15:00' },
  { id: 's3', start: '15:00', end: '18:00' },
  { id: 's4', start: '18:00', end: '21:00' },
];

const PAYMENT_METHODS: PaymentMethod[] = ['knet', 'apple_pay', 'google_pay', 'card', 'cod'];

type Step = 0 | 1 | 2 | 3;

export default function CheckoutPage() {
  const { t, locale } = useT();
  const cart = useCart();
  const supabase = useSupabase();
  const router = useRouter();
  const base = `/${locale}`;

  const hasInstall = cart.lines.some((l) => l.withInstallation);
  const stepKeys = useMemo(
    () => (hasInstall ? ['address', 'delivery', 'installation', 'payment'] : ['address', 'delivery', 'payment']),
    [hasInstall],
  );

  const [step, setStep] = useState<Step>(0);
  const [address, setAddress] = useState({ label: '', governorate: '', area: '', block: '', street: '', building: '', floor: '', apartment: '' });
  const [deliverySlot, setDeliverySlot] = useState('');
  const [installSlot, setInstallSlot] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('knet');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLast = step === stepKeys.length - 1;

  async function placeOrder() {
    setPlacing(true);
    setError(null);
    try {
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth?.user) {
          // REAL flow: sync the local cart into the server cart, persist the
          // address, then invoke the checkout Edge Function (DB-priced).
          const serverCart = await coreCart.getOrCreateCart(supabase, auth.user.id);
          // Reset any stale lines so the server cart mirrors what's on screen.
          const existing = await coreCart.listCartItems(supabase, serverCart.id);
          for (const it of existing) await coreCart.removeItem(supabase, it.id);
          for (const l of cart.lines) {
            await coreCart.addItem(supabase, serverCart.id, l.variantId, l.qty, l.withInstallation);
          }

          const { data: addr, error: addrErr } = await supabase
            .from('addresses')
            .insert({
              user_id: auth.user.id,
              label: address.label || null,
              governorate: address.governorate || null,
              area: address.area || null,
              block: address.block || null,
              street: address.street || null,
              building: address.building || null,
              floor: address.floor || null,
              apartment: address.apartment || null,
            })
            .select('id')
            .single();
          if (addrErr || !addr) throw addrErr ?? new Error('address');

          const slot = SLOTS.find((s) => s.id === deliverySlot);
          const inst = SLOTS.find((s) => s.id === installSlot);
          const res = await coreOrders.checkout(supabase, {
            cart_id: serverCart.id,
            address_id: (addr as { id: string }).id,
            payment_method: payment,
            ...(slot ? { delivery_slot: { start: slot.start, end: slot.end } } : {}),
            ...(hasInstall && inst ? { installation_slot: { start: inst.start, end: inst.end } } : {}),
          });

          cart.clear();
          if (res.payment_url && payment !== 'cod') {
            window.location.href = res.payment_url; // hosted KNET page
          } else {
            router.push(`${base}/checkout/confirmation?order=${encodeURIComponent(res.order_number)}`);
          }
          return;
        }
        // Signed-out on a live backend → authenticate first, then return here.
        router.push(`${base}/auth/login?next=${encodeURIComponent(`${base}/checkout`)}`);
        return;
      }
      // Dev / demo (no backend): simulate a placed order.
      const orderNumber = `NT-${Math.floor(100000 + Math.random() * 899999)}`;
      cart.clear();
      router.push(`${base}/checkout/confirmation?order=${orderNumber}`);
    } catch {
      setError(t('checkout.paymentFailed'));
      setPlacing(false);
    }
  }

  if (cart.lines.length === 0 && !placing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t('cart.empty')}</p>
        <Link href={`${base}/search`} className="mt-4 inline-block">
          <Button>{t('cart.startShopping')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">{t('checkout.title')}</h1>

      {/* Stepper */}
      <ol className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        {stepKeys.map((k, i) => (
          <li key={k} className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                i <= step ? 'bg-primary text-white' : 'bg-neutral-200 text-muted'
              }`}
            >
              {i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-primary' : 'text-muted'}>
              {t(`checkout.steps.${k}`)}
            </span>
            {i < stepKeys.length - 1 && <span className="mx-1 text-neutral-300">›</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Step: address */}
          {stepKeys[step] === 'address' && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">{t('checkout.selectAddress')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('checkout.addressLabel')} value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} className="col-span-2" />
                <Select label={t('checkout.governorate')} value={address.governorate} onChange={(e) => setAddress({ ...address, governorate: e.target.value })}>
                  <option value="">—</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
                <Input label={t('checkout.area')} value={address.area} onChange={(e) => setAddress({ ...address, area: e.target.value })} />
                <Input label={t('checkout.block')} value={address.block} onChange={(e) => setAddress({ ...address, block: e.target.value })} />
                <Input label={t('checkout.street')} value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                <Input label={t('checkout.building')} value={address.building} onChange={(e) => setAddress({ ...address, building: e.target.value })} />
                <Input label={t('checkout.floor')} value={address.floor} onChange={(e) => setAddress({ ...address, floor: e.target.value })} />
                <Input label={t('checkout.apartment')} value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} className="col-span-2" />
              </div>
            </section>
          )}

          {/* Step: delivery slot */}
          {stepKeys[step] === 'delivery' && (
            <SlotPicker title={t('checkout.deliverySlot')} value={deliverySlot} onChange={setDeliverySlot} />
          )}

          {/* Step: installation slot */}
          {stepKeys[step] === 'installation' && (
            <SlotPicker title={t('checkout.installationSlot')} value={installSlot} onChange={setInstallSlot} />
          )}

          {/* Step: payment */}
          {stepKeys[step] === 'payment' && (
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">{t('checkout.paymentMethod')}</h2>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${payment === m ? 'border-primary bg-primary-50' : 'border-border'}`}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="payment" checked={payment === m} onChange={() => setPayment(m)} className="accent-primary" />
                      <span className="text-sm font-medium">{t(`checkout.payment.${m}`)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
            </section>
          )}

          {/* Nav */}
          <div className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => (s - 1) as Step)}>
              {t('common.back')}
            </Button>
            {isLast ? (
              <Button onClick={placeOrder} loading={placing} size="lg">
                {placing ? t('checkout.placingOrder') : t('checkout.placeOrder')}
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => (s + 1) as Step)} size="lg">
                {t('common.continue')}
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <OrderSummary totals={cart.totals} sticky />
        </div>
      </div>
    </div>
  );
}

function SlotPicker({ title, value, onChange }: { title: string; value: string; onChange: (v: string) => void }) {
  const { t, locale } = useT();
  // Next 4 days.
  const days = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="space-y-4">
        {days.map((d) => {
          const dayKey = d.toISOString().slice(0, 10);
          const label = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(d);
          return (
            <div key={dayKey}>
              <p className="mb-2 text-sm font-semibold">{label}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SLOTS.map((s) => {
                  const id = `${dayKey}-${s.id}`;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onChange(id)}
                      className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${value === id ? 'border-primary bg-primary-50 text-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      {s.start}–{s.end}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">{t('checkout.selectSlot')}</p>
    </section>
  );
}
