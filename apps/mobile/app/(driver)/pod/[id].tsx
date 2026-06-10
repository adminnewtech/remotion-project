/**
 * Proof of delivery — capture photo, recipient name, delivery OTP / signature,
 * optional cash-on-delivery amount. Submits via @elite/core
 * `submitProofOfDelivery` and marks the task completed.
 */
import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { submitProofOfDelivery, updateTaskStatus } from '@elite/core';
import { Screen, AppText, AppCard, AppButton, Field } from '../../../components';
import { useLocale } from '../../../lib/i18n';
import { capturePhoto } from '../../../lib/media';
import { getSupabase } from '../../../lib/supabase';
import { hasLiveBackend } from '../../../lib/env';
import { palette, radii, space } from '../../../lib/palette';

export default function ProofOfDeliveryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = String(id);
  const router = useRouter();
  const { t } = useLocale();

  const [photo, setPhoto] = useState<{ uri: string; remoteUrl?: string } | null>(null);
  const [recipient, setRecipient] = useState('');
  const [otp, setOtp] = useState('');
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);

  const onCapture = async () => {
    const result = await capturePhoto(`pod/${taskId}`);
    if (result) setPhoto(result);
  };

  const submit = async () => {
    if (!recipient.trim()) {
      Alert.alert(t('delivery.recipientName'), t('common.required'));
      return;
    }
    setBusy(true);
    try {
      if (hasLiveBackend) {
        const client = getSupabase();
        if (!client) throw new Error('Backend unavailable.');
        await submitProofOfDelivery(client, {
          task_id: taskId,
          photo_url: photo?.remoteUrl ?? null,
          recipient_name: recipient.trim(),
          otp_verified: otp.trim().length >= 4,
          cash_collected: cash ? Number(cash) : null,
        });
        await updateTaskStatus(client, taskId, 'completed');
      }
      Alert.alert(t('delivery.delivered'));
      router.replace('/(driver)');
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('delivery.proofOfDelivery') }} />
      <Screen scroll>
        {/* Photo */}
        <Pressable onPress={onCapture}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photo} />
          ) : (
            <AppCard style={styles.photoPlaceholder}>
              <AppText style={styles.cameraIcon}>📷</AppText>
              <AppText tone="muted">{t('delivery.capturePhoto')}</AppText>
            </AppCard>
          )}
        </Pressable>

        <View style={styles.form}>
          <Field label={t('delivery.recipientName')} value={recipient} onChangeText={setRecipient} />
          <Field
            label={t('delivery.deliveryOtp')}
            placeholder={t('delivery.enterOtp')}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
          />
          <Field
            label={t('delivery.cashToCollect')}
            placeholder="0.000"
            keyboardType="decimal-pad"
            value={cash}
            onChangeText={setCash}
            hint={t('common.optional')}
          />
        </View>

        <AppButton title={t('delivery.confirmDelivery')} variant="success" size="lg" loading={busy} onPress={submit} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: radii.lg, backgroundColor: palette.neutral100 },
  photoPlaceholder: { height: 220, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { fontSize: 40, marginBottom: space.sm },
  form: { marginTop: space.lg },
});
