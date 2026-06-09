/**
 * Active installation job — the technician field flow:
 *   status: en route → arrived → in progress → completed
 *   + checklist, before/after photos, customer signature, notes.
 * Persists via @elite/core `submitInstallationJob` (upsert on task_id) and
 * drives task status with `updateTaskStatus`.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { submitInstallationJob, updateTaskStatus } from '@elite/core';
import type { ChecklistItem, TaskStatus } from '@elite/types';
import { Screen, AppText, AppCard, AppButton, Field, StatusPill, MapTracker } from '../../../components';
import { useMyTasks } from '../../../lib/hooks';
import { useLocale } from '../../../lib/i18n';
import { capturePhoto } from '../../../lib/media';
import { getSupabase } from '../../../lib/supabase';
import { hasLiveBackend } from '../../../lib/env';
import { demoDestinationFor } from '../../../lib/geo';
import { SAMPLE_CHECKLIST } from '../../../lib/sampleData';
import { palette, radii, space } from '../../../lib/palette';

type Photo = { uri: string; remoteUrl?: string };

export default function ActiveJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = String(id);
  const router = useRouter();
  const { t, locale } = useLocale();
  const { data: tasks } = useMyTasks('installation');
  const task = useMemo(() => (tasks ?? []).find((x) => x.id === taskId), [tasks, taskId]);

  const [status, setStatus] = useState<TaskStatus>('accepted');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(SAMPLE_CHECKLIST);
  const [before, setBefore] = useState<Photo[]>([]);
  const [after, setAfter] = useState<Photo[]>([]);
  const [signature, setSignature] = useState<Photo | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const destination = demoDestinationFor(taskId);

  const toggleItem = (i: number) =>
    setChecklist((prev) => prev.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)));

  const addPhoto = async (which: 'before' | 'after' | 'signature') => {
    const result = await capturePhoto(`install/${taskId}/${which}`);
    if (!result) return;
    if (which === 'before') setBefore((p) => [...p, result]);
    else if (which === 'after') setAfter((p) => [...p, result]);
    else setSignature(result);
  };

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
  };

  const complete = async () => {
    if (!checklist.every((c) => c.done)) {
      Alert.alert(t('installation.checklist'), t('common.required'));
      return;
    }
    setBusy(true);
    try {
      if (hasLiveBackend) {
        const client = getSupabase();
        const orderId = task?.order_id;
        if (!client || !orderId) throw new Error('Job context unavailable.');
        await submitInstallationJob(client, {
          task_id: taskId,
          order_id: orderId,
          checklist,
          before_photos: before.map((p) => p.remoteUrl ?? p.uri),
          after_photos: after.map((p) => p.remoteUrl ?? p.uri),
          customer_signature_url: signature?.remoteUrl ?? signature?.uri ?? null,
          notes,
          completed: true,
        });
        await updateTaskStatus(client, taskId, 'completed');
      }
      Alert.alert(t('installation.completed'));
      router.replace('/(technician)');
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('nav.jobs') }} />
      <Screen scroll>
        <MapTracker destination={destination} destinationLabel={task?.area ?? ''} height={200} showRoute={false} />

        {/* Status flow */}
        <AppCard style={styles.section}>
          <View style={styles.statusRow}>
            <AppText weight="700">{task?.area ?? '—'}</AppText>
            <StatusPill taskStatus={status} />
          </View>
          <View style={styles.flow}>
            {status === 'accepted' ? (
              <AppButton title={t('taskStatus.en_route')} size="sm" onPress={() => transition('en_route')} />
            ) : null}
            {status === 'en_route' ? (
              <AppButton title={t('taskStatus.arrived')} size="sm" onPress={() => transition('arrived')} />
            ) : null}
            {status === 'arrived' ? (
              <AppButton title={t('installation.startJob')} size="sm" onPress={() => transition('in_progress')} />
            ) : null}
          </View>
        </AppCard>

        {/* Checklist */}
        <AppText variant="heading" weight="700" style={styles.title}>
          {t('installation.checklist')}
        </AppText>
        <AppCard>
          {checklist.map((item, i) => (
            <Pressable key={i} style={styles.checkRow} onPress={() => toggleItem(i)}>
              <View style={[styles.checkbox, item.done ? styles.checkboxOn : null]}>
                {item.done ? <AppText style={styles.checkMark}>✓</AppText> : null}
              </View>
              <AppText style={styles.checkLabel}>{locale === 'ar' ? item.label_ar : item.label_en}</AppText>
            </Pressable>
          ))}
        </AppCard>

        {/* Before / After photos */}
        <PhotoSection title={t('installation.beforePhotos')} photos={before} onAdd={() => addPhoto('before')} t={t} />
        <PhotoSection title={t('installation.afterPhotos')} photos={after} onAdd={() => addPhoto('after')} t={t} />

        {/* Signature */}
        <AppText variant="heading" weight="700" style={styles.title}>
          {t('installation.customerSignature')}
        </AppText>
        <Pressable onPress={() => addPhoto('signature')}>
          {signature ? (
            <Image source={{ uri: signature.uri }} style={styles.signature} />
          ) : (
            <AppCard style={styles.signaturePlaceholder}>
              <AppText tone="muted">✍️ {t('installation.signOff')}</AppText>
            </AppCard>
          )}
        </Pressable>

        {/* Notes */}
        <View style={styles.title}>
          <Field label={t('installation.notes')} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        </View>

        <AppButton title={t('installation.completeJob')} variant="success" size="lg" loading={busy} onPress={complete} />
      </Screen>
    </>
  );
}

function PhotoSection({
  title,
  photos,
  onAdd,
  t,
}: {
  title: string;
  photos: Photo[];
  onAdd: () => void;
  t: (k: string) => string;
}) {
  return (
    <>
      <AppText variant="heading" weight="700" style={styles.title}>
        {title}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {photos.map((p, i) => (
          <Image key={i} source={{ uri: p.uri }} style={styles.thumb} />
        ))}
        <Pressable style={styles.addPhoto} onPress={onAdd}>
          <AppText style={styles.addIcon}>＋</AppText>
          <AppText variant="caption" tone="muted">
            {t('delivery.capturePhoto')}
          </AppText>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flow: { marginTop: space.md, flexDirection: 'row', gap: space.sm },
  title: { marginTop: space.lg, marginBottom: space.sm },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: palette.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: space.md,
  },
  checkboxOn: { backgroundColor: palette.success, borderColor: palette.success },
  checkMark: { color: '#fff', fontWeight: '700' },
  checkLabel: { flex: 1 },
  photoRow: { paddingVertical: space.xs },
  thumb: { width: 88, height: 88, borderRadius: radii.md, marginEnd: space.sm, backgroundColor: palette.neutral100 },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.neutral300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { fontSize: 24, color: palette.neutral400 },
  signature: { width: '100%', height: 160, borderRadius: radii.lg, backgroundColor: palette.neutral100 },
  signaturePlaceholder: { height: 160, alignItems: 'center', justifyContent: 'center' },
});
