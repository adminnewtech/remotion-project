/**
 * Phone-OTP login — step 2: enter the SMS code. On success the root navigator
 * detects the new session and redirects into the role's home group.
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, AppText, AppButton, Field } from '../../components';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { space } from '../../lib/palette';

const RESEND_SECONDS = 45;

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { t } = useLocale();
  const { verifyOtp, sendOtp, isConfigured } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const onVerify = async () => {
    setError(null);
    if (code.replace(/\D/g, '').length < 4) {
      setError(t('auth.invalidOtp'));
      return;
    }
    setBusy(true);
    try {
      if (isConfigured) {
        await verifyOtp(String(phone), code);
        // Root navigator redirects on session change.
      } else {
        // Demo mode: no backend — drop straight into the storefront.
        router.replace('/(customer)');
      }
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    try {
      if (isConfigured) await sendOtp(String(phone));
      setSeconds(RESEND_SECONDS);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title" weight="700">
          {t('auth.otpTitle')}
        </AppText>
        <AppText tone="muted" style={styles.sub}>
          {t('auth.otpSubtitle', { phone: String(phone ?? '') })}
        </AppText>
      </View>

      <Field
        label={t('auth.otpTitle')}
        placeholder="••••••"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        error={error}
        style={styles.codeInput}
      />

      <AppButton title={t('auth.verify')} onPress={onVerify} loading={busy} size="lg" />

      <View style={styles.resend}>
        <AppButton
          title={seconds > 0 ? t('auth.otpResendIn', { seconds }) : t('auth.otpResend')}
          variant="ghost"
          disabled={seconds > 0}
          onPress={onResend}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.xl, marginBottom: space.lg },
  sub: { marginTop: space.xs },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 24 },
  resend: { marginTop: space.md, alignItems: 'center' },
});
