/**
 * Technician Jobs — scheduled installation queue with windows, area & map
 * entry. Tap a job to open the active-job flow.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, AppCard, StatusPill, AppButton, EmptyState, Loader } from '../../components';
import { useMyTasks } from '../../lib/hooks';
import { useLocale } from '../../lib/i18n';
import { space } from '../../lib/palette';

export default function TechnicianJobsScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { data, isLoading, isFetching, refetch } = useMyTasks('installation');

  if (isLoading) return <Loader />;
  const jobs = data ?? [];

  return (
    <Screen scroll refreshing={isFetching} onRefresh={refetch}>
      <AppText variant="title" weight="700" style={styles.title}>
        {t('nav.jobs')}
      </AppText>

      {jobs.length === 0 ? (
        <EmptyState icon="🔧" title={t('common.noResults')} />
      ) : (
        jobs.map((job) => (
          <AppCard key={job.id} style={styles.card} onPress={() => router.push(`/(technician)/job/${job.id}`)}>
            <View style={styles.headerRow}>
              <View style={styles.info}>
                <AppText weight="700">{job.area ?? '—'}</AppText>
                <AppText variant="caption" tone="muted">
                  {t('installation.scheduledWindow')}: {job.scheduled_for ?? '—'}
                </AppText>
              </View>
              <StatusPill taskStatus={job.status} />
            </View>
            <View style={styles.actions}>
              <AppButton
                title={t('installation.startJob')}
                size="sm"
                onPress={() => router.push(`/(technician)/job/${job.id}`)}
              />
            </View>
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.md },
  card: { marginBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1, marginEnd: space.md },
  actions: { marginTop: space.md, flexDirection: 'row', justifyContent: 'flex-end' },
});
