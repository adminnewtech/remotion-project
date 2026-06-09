/**
 * Support — list of tickets with status, plus a "new request" action that
 * opens a ticket (live mode) and navigates into the chat thread.
 */
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { createTicket } from '@elite/core';
import { formatDate } from '../../../lib/theme';
import { Screen, AppText, AppCard, StatusPill, AppButton, EmptyState, Loader } from '../../../components';
import { useTickets } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { useLocale } from '../../../lib/i18n';
import { getSupabase } from '../../../lib/supabase';
import { hasLiveBackend } from '../../../lib/env';
import { space } from '../../../lib/palette';

export default function SupportScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const { profile } = useAuth();
  const { data, isLoading, refetch, isFetching } = useTickets();

  const tickets = data ?? [];

  const newTicket = async () => {
    if (hasLiveBackend) {
      const client = getSupabase();
      if (!client || !profile?.id) return;
      try {
        const ticket = await createTicket(client, {
          user_id: profile.id,
          subject: t('support.newTicket'),
          kind: 'general',
        });
        await refetch();
        router.push(`/(customer)/support/${ticket.id}`);
      } catch (e) {
        Alert.alert(t('common.error'), (e as Error).message);
      }
    } else {
      router.push('/(customer)/support/tk-1');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('support.title') }} />
      <Screen scroll refreshing={isFetching} onRefresh={refetch}>
        <AppButton title={t('support.newTicket')} style={styles.new} onPress={newTicket} />

        {isLoading ? (
          <Loader />
        ) : tickets.length === 0 ? (
          <EmptyState icon="💬" title={t('support.empty')} />
        ) : (
          tickets.map((tk) => (
            <AppCard key={tk.id} style={styles.card} onPress={() => router.push(`/(customer)/support/${tk.id}`)}>
              <AppText weight="700">{tk.subject}</AppText>
              <AppText variant="caption" tone="muted" style={styles.meta}>
                {t(`support.kind.${tk.kind}`)} · {formatDate(tk.created_at)}
              </AppText>
              <StatusPill tone="info" label={t(`support.status.${tk.status}`)} style={styles.pill} />
            </AppCard>
          ))
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  new: { marginBottom: space.md },
  card: { marginBottom: space.sm },
  meta: { marginTop: space.xs },
  pill: { marginTop: space.sm },
});
