/**
 * Orders list — order cards with status pill, total, and quick links to the
 * detail / live tracking screens.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatKWD, formatDate } from '../../lib/theme';
import { Screen, AppText, AppCard, StatusPill, AppButton, EmptyState, Loader } from '../../components';
import { useOrders } from '../../lib/hooks';
import { useLocale } from '../../lib/i18n';
import { space } from '../../lib/palette';

export default function OrdersScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { data, isLoading, isFetching, refetch } = useOrders();

  if (isLoading) return <Loader />;
  const orders = data ?? [];

  if (orders.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="📦"
          title={t('orders.empty')}
          actionLabel={t('cart.startShopping')}
          onAction={() => router.push('/(customer)/catalog')}
        />
      </Screen>
    );
  }

  const trackable = (status: string) =>
    ['paid', 'processing', 'out_for_delivery', 'installing'].includes(status);

  return (
    <Screen scroll refreshing={isFetching} onRefresh={refetch}>
      <AppText variant="title" weight="700" style={styles.title}>
        {t('orders.title')}
      </AppText>

      {orders.map((o) => (
        <AppCard key={o.id} style={styles.card} onPress={() => router.push(`/(customer)/order/${o.id}`)}>
          <View style={styles.headerRow}>
            <AppText weight="700">{t('orders.orderNumber', { number: o.order_number })}</AppText>
            <StatusPill orderStatus={o.status} />
          </View>
          <AppText variant="caption" tone="muted" style={styles.date}>
            {t('orders.placedOn', { date: formatDate(o.placed_at ?? o.created_at) })}
          </AppText>
          <View style={styles.footerRow}>
            <AppText variant="subtitle" weight="700">
              {formatKWD(o.total)}
            </AppText>
            {trackable(o.status) ? (
              <AppButton
                title={t('orders.trackOrder')}
                size="sm"
                fullWidth={false}
                onPress={() => router.push(`/(customer)/track/${o.id}`)}
              />
            ) : null}
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.md },
  card: { marginBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { marginTop: space.xs },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
});
