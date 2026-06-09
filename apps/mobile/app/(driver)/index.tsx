/**
 * Driver Tasks — today's delivery queue (ordered by sequence). Accept assigned
 * tasks; tap an accepted/active task to open the active-delivery screen.
 */
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { acceptTask } from '@elite/core';
import { Screen, AppText, AppCard, StatusPill, AppButton, EmptyState, Loader } from '../../components';
import { useMyTasks, useQueryClient } from '../../lib/hooks';
import { useLocale } from '../../lib/i18n';
import { getSupabase } from '../../lib/supabase';
import { hasLiveBackend } from '../../lib/env';
import { qk } from '../../lib/queryClient';
import { space } from '../../lib/palette';

export default function DriverTasksScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useMyTasks('delivery');

  const tasks = data ?? [];

  const accept = async (taskId: string) => {
    if (hasLiveBackend) {
      const client = getSupabase();
      if (!client) return;
      try {
        await acceptTask(client, taskId);
        void qc.invalidateQueries({ queryKey: qk.myTasks });
        await refetch();
      } catch (e) {
        Alert.alert(t('common.error'), (e as Error).message);
      }
    }
    router.push(`/(driver)/active/${taskId}`);
  };

  if (isLoading) return <Loader />;

  return (
    <Screen scroll refreshing={isFetching} onRefresh={refetch}>
      <AppText variant="title" weight="700" style={styles.title}>
        {t('nav.tasks')}
      </AppText>
      <AppText tone="muted" style={styles.sub}>
        {t('common.today')} · {t('common.items', { count: tasks.length })}
      </AppText>

      {tasks.length === 0 ? (
        <EmptyState icon="🚚" title={t('common.noResults')} />
      ) : (
        tasks.map((task) => (
          <AppCard key={task.id} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.seq}>
                <AppText weight="700">{task.sequence ?? '•'}</AppText>
              </View>
              <View style={styles.info}>
                <AppText weight="700">{task.area ?? '—'}</AppText>
                <AppText variant="caption" tone="muted">
                  {task.window_start ? `${formatTime(task.window_start)} – ${formatTime(task.window_end)}` : ''}
                </AppText>
              </View>
              <StatusPill taskStatus={task.status} />
            </View>
            <View style={styles.actions}>
              {task.status === 'assigned' ? (
                <AppButton title={t('common.confirm')} size="sm" onPress={() => accept(task.id)} />
              ) : (
                <AppButton
                  title={t('nav.deliveries')}
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/(driver)/active/${task.id}`)}
                />
              )}
            </View>
          </AppCard>
        ))
      )}
    </Screen>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  title: { marginBottom: space.xs },
  sub: { marginBottom: space.md },
  card: { marginBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  seq: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: space.md,
  },
  info: { flex: 1 },
  actions: { marginTop: space.md, flexDirection: 'row', justifyContent: 'flex-end' },
});
