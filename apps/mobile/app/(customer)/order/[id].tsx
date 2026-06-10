/**
 * Order detail — line items, totals, warranty info, and entry to live
 * tracking and support.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { formatKWD, formatDate } from '../../../lib/theme';
import { Screen, AppText, AppCard, AppButton, StatusPill, Loader, EmptyState } from '../../../components';
import { useOrder } from '../../../lib/hooks';
import { useLocale } from '../../../lib/i18n';
import { palette, space } from '../../../lib/palette';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const { data: order, isLoading } = useOrder(String(id));

  if (isLoading) return <Loader />;
  if (!order) return <EmptyState icon="❓" title={t('common.notFound')} />;

  const trackable = ['paid', 'processing', 'out_for_delivery', 'installing'].includes(order.status);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('orders.orderNumber', { number: order.order_number }) }} />
      <Screen scroll>
        <View style={styles.headerRow}>
          <AppText variant="caption" tone="muted">
            {t('orders.placedOn', { date: formatDate(order.placed_at ?? order.created_at) })}
          </AppText>
          <StatusPill orderStatus={order.status} />
        </View>

        {trackable ? (
          <AppButton
            title={t('orders.trackOrder')}
            style={styles.track}
            onPress={() => router.push(`/(customer)/track/${order.id}`)}
          />
        ) : null}

        {/* Items */}
        <AppText variant="heading" weight="700" style={styles.section}>
          {t('orders.items')}
        </AppText>
        <AppCard>
          {order.items.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={styles.itemBody}>
                <AppText weight="600">{it.name_snapshot}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('common.quantity')}: {it.qty}
                  {it.with_installation ? ` · ${t('cart.withInstallation')}` : ''}
                </AppText>
                {it.warranty_expires_at ? (
                  <AppText variant="caption" tone="success">
                    🛡️ {t('orders.warrantyCard')} · {formatDate(it.warranty_expires_at)}
                  </AppText>
                ) : null}
              </View>
              <AppText weight="700">{formatKWD(it.line_total)}</AppText>
            </View>
          ))}
        </AppCard>

        {/* Totals */}
        <AppCard style={styles.section}>
          <Row label={t('cart.subtotal')} value={formatKWD(order.subtotal)} />
          <Row label={t('cart.deliveryFee')} value={order.delivery_fee === 0 ? t('cart.freeDelivery') : formatKWD(order.delivery_fee)} />
          {order.installation_fee > 0 ? <Row label={t('cart.installationFee')} value={formatKWD(order.installation_fee)} /> : null}
          {order.discount_total > 0 ? <Row label={t('cart.discount')} value={`- ${formatKWD(order.discount_total)}`} /> : null}
          <View style={styles.divider} />
          <Row label={t('cart.total')} value={formatKWD(order.total)} bold />
        </AppCard>

        <View style={styles.actions}>
          <AppButton title={t('orders.viewInvoice')} variant="outline" onPress={() => undefined} />
          <AppButton title={t('support.contactUs')} variant="ghost" onPress={() => router.push('/(customer)/support')} />
        </View>
      </Screen>
    </>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { marginTop: space.md },
  section: { marginTop: space.lg, marginBottom: space.sm },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  itemBody: { flex: 1, marginEnd: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginVertical: space.sm },
  actions: { marginTop: space.lg, gap: space.sm },
});
