/**
 * Live order tracking — the Keeta-style screen:
 *   - live driver map (react-native-maps) updated via realtime GPS pings
 *   - order status timeline
 *   - installation progress (when the order has an installation task)
 *
 * Realtime: subscribes to order status + driver-location channels through
 * @elite/core; falls back to the periodic `trackOrder` refetch when no live
 * backend.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { subscribeToDriverLocation, subscribeToOrderStatus } from '@elite/core';
import type { DriverLocation, OrderStatus } from '@elite/types';
import { Screen, AppText, AppCard, StatusPill, MapTracker, Timeline, Loader, EmptyState } from '../../../components';
import type { LatLng, TimelineStep } from '../../../components';
import { useOrderTracking } from '../../../lib/hooks';
import { getSupabase } from '../../../lib/supabase';
import { useLocale } from '../../../lib/i18n';
import { ORDER_TIMELINE, orderStatusKey } from '../../../lib/status';
import { KUWAIT_CENTER } from '../../../lib/sampleData';
import { space } from '../../../lib/palette';

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { data, isLoading, refetch } = useOrderTracking(String(id));

  const [liveStatus, setLiveStatus] = useState<OrderStatus | null>(null);
  const [driverLoc, setDriverLoc] = useState<DriverLocation | null>(null);

  const deliveryTask = data?.tasks.find((task) => task.type === 'delivery');
  const installTask = data?.tasks.find((task) => task.type === 'installation');

  // Realtime subscriptions (live backend only).
  useEffect(() => {
    const client = getSupabase();
    if (!client || !data) return;

    const statusCh = subscribeToOrderStatus(client, String(id), (status) => {
      setLiveStatus(status);
      void refetch();
    });

    const locCh = deliveryTask
      ? subscribeToDriverLocation(client, deliveryTask.id, (loc) => setDriverLoc(loc))
      : null;

    return () => {
      void client.removeChannel(statusCh);
      if (locCh) void client.removeChannel(locCh);
    };
  }, [id, data, deliveryTask, refetch]);

  if (isLoading) return <Loader />;
  if (!data) return <EmptyState icon="❓" title={t('common.notFound')} />;

  const status = liveStatus ?? data.order.status;
  const activeIndex = Math.max(0, ORDER_TIMELINE.indexOf(status));

  const steps: TimelineStep[] = ORDER_TIMELINE.map((s) => ({ key: s, label: t(orderStatusKey(s)) }));

  // Resolve map coordinates: live GPS ping → origin; address (or demo center) → destination.
  const ping = driverLoc ?? data.driverLocation;
  let origin: LatLng | null = null;
  if (ping) {
    origin = { latitude: ping.lat, longitude: ping.lng };
  } else if (status === 'out_for_delivery') {
    // No live GPS yet — show an approximate position near the destination.
    origin = { latitude: KUWAIT_CENTER.latitude + 0.02, longitude: KUWAIT_CENTER.longitude - 0.015 };
  }
  const destination: LatLng = KUWAIT_CENTER;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('delivery.tracking') }} />
      <Screen scroll>
        {/* Map */}
        <MapTracker
          origin={origin}
          destination={destination}
          originLabel={t('delivery.driver')}
          destinationLabel={t('checkout.area')}
          height={280}
        />

        {/* Current status banner */}
        <AppCard style={styles.banner}>
          <View style={styles.bannerRow}>
            <View style={styles.bannerText}>
              <AppText weight="700">{t('orders.orderNumber', { number: data.order.order_number })}</AppText>
              <AppText tone="muted" variant="caption">
                {status === 'out_for_delivery' ? t('delivery.driverOnTheWay') : t(orderStatusKey(status))}
              </AppText>
            </View>
            <StatusPill orderStatus={status} />
          </View>
          {status === 'out_for_delivery' ? (
            <AppText tone="primary" weight="600" style={styles.eta}>
              {t('delivery.arrivingIn', { minutes: 12 })}
            </AppText>
          ) : null}
        </AppCard>

        {/* Timeline */}
        <AppText variant="heading" weight="700" style={styles.section}>
          {t('orders.timeline')}
        </AppText>
        <AppCard>
          <Timeline steps={steps} activeIndex={activeIndex} />
        </AppCard>

        {/* Installation progress */}
        {installTask ? (
          <>
            <AppText variant="heading" weight="700" style={styles.section}>
              {t('installation.tracking')}
            </AppText>
            <AppCard>
              <View style={styles.installRow}>
                <AppText tone="muted">{t('installation.scheduledWindow')}</AppText>
                <AppText weight="600">{installTask.scheduled_for ?? '—'}</AppText>
              </View>
              <View style={styles.installRow}>
                <AppText tone="muted">{t('installation.technician')}</AppText>
                <StatusPill taskStatus={installTask.status} />
              </View>
            </AppCard>
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { marginTop: space.md },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerText: { flex: 1, marginEnd: space.md },
  eta: { marginTop: space.sm },
  section: { marginTop: space.lg, marginBottom: space.sm },
  installRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
});
