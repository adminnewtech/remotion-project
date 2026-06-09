/**
 * Cart — line items with qty steppers, installation flag, promo entry, totals
 * (subtotal / delivery / installation), and a checkout CTA. Totals come from
 * the pure `cartTotals` helper via the cart context.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatKWD } from '../../lib/theme';
import { FREE_DELIVERY_THRESHOLD_KWD } from '@elite/types';
import { Screen, AppText, AppButton, AppCard, Field, EmptyState, PriceText } from '../../components';
import { useCart } from '../../lib/cart';
import { useLocale } from '../../lib/i18n';
import { variantDisplayName } from '../../lib/variant';
import { palette, radii, space } from '../../lib/palette';

export default function CartScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { items, totals, setQty } = useCart();
  const [promo, setPromo] = useState('');

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="🛒"
          title={t('cart.empty')}
          message={t('cart.emptyHint')}
          actionLabel={t('cart.startShopping')}
          onAction={() => router.push('/(customer)/catalog')}
        />
      </Screen>
    );
  }

  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD_KWD - totals.subtotal);

  return (
    <Screen scroll>
      <AppText variant="title" weight="700">
        {t('cart.title')}
      </AppText>

      <View style={styles.list}>
        {items.map((item) => (
          <AppCard key={item.id} style={styles.item}>
            <View style={styles.itemRow}>
              <View style={styles.thumb}>
                <AppText>📦</AppText>
              </View>
              <View style={styles.itemBody}>
                <AppText weight="600" numberOfLines={2}>
                  {variantDisplayName(item.variant_id)}
                </AppText>
                {item.with_installation ? (
                  <AppText variant="caption" tone="primary">
                    + {t('cart.withInstallation')}
                  </AppText>
                ) : null}
                <View style={styles.stepperRow}>
                  <Stepper
                    qty={item.qty}
                    onDec={() => setQty(item.id, item.qty - 1)}
                    onInc={() => setQty(item.id, item.qty + 1)}
                  />
                  <Pressable onPress={() => setQty(item.id, 0)}>
                    <AppText tone="danger" variant="caption">
                      {t('cart.removeItem')}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </View>
          </AppCard>
        ))}
      </View>

      {/* Promo */}
      <View style={styles.promo}>
        <View style={styles.promoField}>
          <Field placeholder={t('cart.promoPlaceholder')} value={promo} onChangeText={setPromo} containerStyle={styles.noMargin} />
        </View>
        <AppButton title={t('cart.applyPromo')} variant="outline" fullWidth={false} onPress={() => undefined} />
      </View>

      {/* Free-delivery hint */}
      {remaining > 0 ? (
        <View style={styles.freeHint}>
          <AppText variant="caption" tone="primary">
            {t('cart.freeDeliveryHint', { amount: formatKWD(remaining) })}
          </AppText>
        </View>
      ) : null}

      {/* Totals */}
      <AppCard style={styles.totals}>
        <Row label={t('cart.subtotal')} value={formatKWD(totals.subtotal)} />
        <Row
          label={t('cart.deliveryFee')}
          value={totals.deliveryFee === 0 ? t('cart.freeDelivery') : formatKWD(totals.deliveryFee)}
        />
        {totals.installationFee > 0 ? (
          <Row label={t('cart.installationFee')} value={formatKWD(totals.installationFee)} />
        ) : null}
        <View style={styles.divider} />
        <View style={styles.grandRow}>
          <AppText variant="subtitle" weight="700">
            {t('cart.total')}
          </AppText>
          <PriceText amount={totals.total} size="md" tone="primary" />
        </View>
      </AppCard>

      <AppButton title={t('cart.checkout')} size="lg" onPress={() => router.push('/(customer)/checkout')} />
    </Screen>
  );
}

function Stepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable style={styles.stepBtn} onPress={onDec}>
        <AppText weight="700">−</AppText>
      </Pressable>
      <AppText weight="600" style={styles.qty}>
        {qty}
      </AppText>
      <Pressable style={styles.stepBtn} onPress={onInc}>
        <AppText weight="700">+</AppText>
      </Pressable>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText tone="muted">{label}</AppText>
      <AppText weight="600">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.md },
  item: { marginBottom: space.sm },
  itemRow: { flexDirection: 'row' },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: palette.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: space.md,
  },
  itemBody: { flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: palette.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 32, textAlign: 'center' },
  promo: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  promoField: { flex: 1, marginEnd: space.sm },
  noMargin: { marginBottom: 0 },
  freeHint: { marginTop: space.sm },
  totals: { marginTop: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: space.sm },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
