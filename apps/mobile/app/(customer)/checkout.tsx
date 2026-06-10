/**
 * Checkout — address (Kuwait model) → delivery slot → optional installation
 * slot → payment method → place order. Live mode invokes the `checkout` Edge
 * Function via @elite/core; demo mode simulates a placed order.
 */
import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { checkout } from '@elite/core';
import type { PaymentMethod } from '@elite/types';
import { formatKWD } from '../../lib/theme';
import { Screen, AppText, AppButton, AppCard, Field } from '../../components';
import { useCart } from '../../lib/cart';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';
import { hasLiveBackend } from '../../lib/env';
import { createAddress, slotToWindow } from '../../lib/address';
import { palette, radii, space } from '../../lib/palette';

const PAYMENT_METHODS: PaymentMethod[] = ['knet', 'apple_pay', 'google_pay', 'card', 'cod'];
const SLOTS = ['10:00 – 12:00', '12:00 – 14:00', '14:00 – 16:00', '16:00 – 18:00', '18:00 – 20:00'];

export default function CheckoutScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { profile } = useAuth();
  const { items, totals, cartId, clear } = useCart();

  const needsInstall = items.some((i) => i.with_installation);
  const [governorate, setGovernorate] = useState('');
  const [area, setArea] = useState('');
  const [block, setBlock] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [deliverySlot, setDeliverySlot] = useState<string | null>(null);
  const [installSlot, setInstallSlot] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('knet');
  const [busy, setBusy] = useState(false);

  const placeOrder = async () => {
    if (!area.trim()) {
      Alert.alert(t('checkout.selectAddress'), t('checkout.area'));
      return;
    }
    if (!deliverySlot) {
      Alert.alert(t('checkout.selectSlot'));
      return;
    }
    if (needsInstall && !installSlot) {
      Alert.alert(t('checkout.selectSlot'), t('checkout.installationSlot'));
      return;
    }
    setBusy(true);
    try {
      if (hasLiveBackend) {
        const client = getSupabase();
        if (!client || !cartId || !profile?.id) throw new Error('Checkout unavailable.');

        // Persist the entered Kuwait address to get a real address_id.
        const addressId = await createAddress(profile.id, {
          governorate: governorate.trim() || undefined,
          area: area.trim(),
          block: block.trim() || undefined,
          street: street.trim() || undefined,
          building: building.trim() || undefined,
        });

        const result = await checkout(client, {
          cart_id: cartId,
          address_id: addressId,
          payment_method: method,
          delivery_slot: slotToWindow(deliverySlot),
          installation_slot: needsInstall && installSlot ? slotToWindow(installSlot) : undefined,
        });
        clear();

        // KNET / card flows return a hosted payment URL — hand off to it.
        if (result.payment_url) {
          await Linking.openURL(result.payment_url);
        }
        Alert.alert(t('checkout.orderPlaced'), t('checkout.orderPlacedHint', { orderNumber: result.order_number }));
        router.replace(`/(customer)/order/${result.order_id}`);
      } else {
        // Demo: simulate placement and route to the sample order tracking.
        clear();
        Alert.alert(t('checkout.orderPlaced'), t('checkout.orderPlacedHint', { orderNumber: 'NT-1001' }));
        router.replace('/(customer)/order/o-1001');
      }
    } catch (e) {
      Alert.alert(t('checkout.paymentFailed'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('checkout.title') }} />
      <Screen scroll>
        {/* Address */}
        <SectionTitle text={t('checkout.selectAddress')} />
        <AppCard style={styles.section}>
          <Field label={t('checkout.governorate')} value={governorate} onChangeText={setGovernorate} />
          <Field label={t('checkout.area')} value={area} onChangeText={setArea} />
          <View style={styles.grid}>
            <View style={styles.col}>
              <Field label={t('checkout.block')} value={block} onChangeText={setBlock} keyboardType="number-pad" />
            </View>
            <View style={styles.col}>
              <Field label={t('checkout.street')} value={street} onChangeText={setStreet} />
            </View>
          </View>
          <Field label={t('checkout.building')} value={building} onChangeText={setBuilding} />
        </AppCard>

        {/* Delivery slot */}
        <SectionTitle text={t('checkout.deliverySlot')} />
        <SlotPicker slots={SLOTS} value={deliverySlot} onChange={setDeliverySlot} />

        {/* Installation slot */}
        {needsInstall ? (
          <>
            <SectionTitle text={t('checkout.installationSlot')} />
            <SlotPicker slots={SLOTS} value={installSlot} onChange={setInstallSlot} />
          </>
        ) : null}

        {/* Payment */}
        <SectionTitle text={t('checkout.paymentMethod')} />
        <View style={styles.section}>
          {PAYMENT_METHODS.map((m) => {
            const active = m === method;
            return (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.payRow, active ? styles.payRowActive : null]}
              >
                <AppText weight={active ? '700' : '500'}>{t(`checkout.payment.${m}`)}</AppText>
                <View style={[styles.radio, active ? styles.radioActive : null]} />
              </Pressable>
            );
          })}
        </View>

        {/* Summary */}
        <SectionTitle text={t('checkout.orderSummary')} />
        <AppCard style={styles.section}>
          <Row label={t('cart.subtotal')} value={formatKWD(totals.subtotal)} />
          <Row label={t('cart.deliveryFee')} value={totals.deliveryFee === 0 ? t('cart.freeDelivery') : formatKWD(totals.deliveryFee)} />
          {totals.installationFee > 0 ? <Row label={t('cart.installationFee')} value={formatKWD(totals.installationFee)} /> : null}
          <View style={styles.divider} />
          <Row label={t('cart.total')} value={formatKWD(totals.total)} bold />
        </AppCard>

        <AppButton title={t('checkout.placeOrder')} size="lg" loading={busy} onPress={placeOrder} />
      </Screen>
    </>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <AppText variant="heading" weight="700" style={styles.sectionTitle}>
      {text}
    </AppText>
  );
}

function SlotPicker({
  slots,
  value,
  onChange,
}: {
  slots: string[];
  value: string | null;
  onChange: (s: string) => void;
}) {
  return (
    <View style={[styles.section, styles.slotWrap]}>
      {slots.map((s) => {
        const active = s === value;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={[styles.slot, active ? styles.slotActive : null]}
          >
            <AppText variant="caption" weight="600" style={{ color: active ? palette.primaryFg : palette.foreground }}>
              {s}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText tone="muted" weight={bold ? '700' : '400'}>
        {label}
      </AppText>
      <AppText weight={bold ? '700' : '600'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: space.lg, marginBottom: space.sm },
  section: { marginBottom: space.sm },
  grid: { flexDirection: 'row', marginHorizontal: -space.xs },
  col: { flex: 1, paddingHorizontal: space.xs },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    backgroundColor: palette.neutral100,
    marginEnd: space.sm,
    marginBottom: space.sm,
  },
  slotActive: { backgroundColor: palette.primary },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    marginBottom: space.sm,
  },
  payRowActive: { borderColor: palette.primary, backgroundColor: palette.primaryLight },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.neutral300 },
  radioActive: { borderColor: palette.primary, backgroundColor: palette.primary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: space.sm },
});
