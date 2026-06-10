/**
 * Active delivery — live GPS streaming + status transitions + navigation
 * handoff. While the delivery is en route, the driver's position is streamed
 * to `driver_locations` (via @elite/core `pushDriverLocation`) so the customer
 * tracking map updates in realtime. A "Navigate" button hands off to the
 * native maps app; "Arrived"/"Proof of delivery" drive the task lifecycle.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { pushDriverLocation, updateTaskStatus } from '@elite/core';
import type { LocationSubscription } from 'expo-location';
import type { TaskStatus } from '@elite/types';
import { Screen, AppText, AppCard, AppButton, StatusPill, MapTracker } from '../../../components';
import type { LatLng } from '../../../components';
import { useLocale } from '../../../lib/i18n';
import { getSupabase } from '../../../lib/supabase';
import { hasLiveBackend } from '../../../lib/env';
import { demoDestinationFor } from '../../../lib/geo';
import { space } from '../../../lib/palette';

export default function ActiveDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = String(id);
  const router = useRouter();
  const { t } = useLocale();

  const [status, setStatus] = useState<TaskStatus>('accepted');
  const [self, setSelf] = useState<LatLng | null>(null);
  const [streaming, setStreaming] = useState(false);
  const watchRef = useRef<LocationSubscription | null>(null);

  const destination = demoDestinationFor(taskId);

  const stopStreaming = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    setStreaming(false);
  }, []);

  // Stream GPS while en route.
  const startStreaming = useCallback(async () => {
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert(t('common.error'), 'Location permission required to stream your position.');
      return;
    }
    setStreaming(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 25, timeInterval: 5000 },
      (loc) => {
        const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setSelf(point);
        const client = getSupabase();
        if (hasLiveBackend && client) {
          void pushDriverLocation(client, {
            task_id: taskId,
            lat: point.latitude,
            lng: point.longitude,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
          });
        }
      },
    );
  }, [taskId, t]);

  useEffect(() => () => stopStreaming(), [stopStreaming]);

  const transition = async (next: TaskStatus) => {
    setStatus(next);
    if (hasLiveBackend) {
      const client = getSupabase();
      if (client) {
        try {
          await updateTaskStatus(client, taskId, next);
        } catch (e) {
          Alert.alert(t('common.error'), (e as Error).message);
        }
      }
    }
    if (next === 'en_route') void startStreaming();
    if (next === 'arrived') stopStreaming();
  };

  const navigate = () => {
    const { latitude, longitude } = destination;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    void Linking.openURL(url as string);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('nav.deliveries') }} />
      <Screen scroll>
        <MapTracker origin={self} destination={destination} originLabel={t('roles.driver')} height={300} />

        <AppCard style={styles.card}>
          <View style={styles.statusRow}>
            <AppText weight="700">{t('delivery.tracking')}</AppText>
            <StatusPill taskStatus={status} />
          </View>
          {streaming ? (
            <AppText variant="caption" tone="success" style={styles.live}>
              ● {t('delivery.driverOnTheWay')}
            </AppText>
          ) : null}
        </AppCard>

        <View style={styles.actions}>
          <AppButton title={t('delivery.callDriver')} variant="outline" onPress={navigate} />
          {status === 'accepted' ? (
            <AppButton title={t('taskStatus.en_route')} onPress={() => transition('en_route')} />
          ) : null}
          {status === 'en_route' ? (
            <AppButton title={t('taskStatus.arrived')} onPress={() => transition('arrived')} />
          ) : null}
          {(status === 'arrived' || status === 'en_route') ? (
            <AppButton
              title={t('delivery.proofOfDelivery')}
              variant="success"
              onPress={() => router.push(`/(driver)/pod/${taskId}`)}
            />
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { marginTop: space.sm },
  actions: { marginTop: space.lg, gap: space.sm },
});
