/**
 * Phone-OTP login — step 1: enter Kuwait phone number, request an SMS code.
 * On success, navigates to the verify screen with the phone in params.
 */
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, AppButton, Field } from '../../components';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { palette, space, radii } from '../../lib/palette';

export default function LoginScreen() {
  const router = useRouter();
  const { t, toggleLocale, locale } = useLocale();
  const { sendOtp, isConfigured } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSend = async () => {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setBusy(true);
    try {
      if (isConfigured) await sendOtp(phone);
      router.push({ pathname: '/(auth)/verify', params: { phone } });
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <AppText weight="700" style={styles.logoText}>
              E
            </AppText>
          </View>
          <AppText variant="title" center weight="700">
            {t('common.appName')}
          </AppText>
          <AppText tone="muted" center style={styles.tagline}>
            {t('auth.welcome')}
          </AppText>
        </View>

        <View style={styles.form}>
          <Field
            label={t('auth.phone')}
            placeholder={t('auth.phonePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            error={error}
          />
          <AppButton title={t('auth.sendCode')} onPress={onSend} loading={busy} size="lg" />
          <AppText variant="caption" tone="muted" center style={styles.terms}>
            {t('auth.termsAgree')}
          </AppText>
        </View>

        <View style={styles.footer}>
          <AppButton
            title={locale === 'ar' ? 'English' : 'العربية'}
            variant="ghost"
            fullWidth={false}
            onPress={toggleLocale}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: space['2xl'], marginBottom: space.xl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  logoText: { color: palette.primaryFg, fontSize: 36 },
  tagline: { marginTop: space.xs },
  form: { marginTop: space.lg },
  terms: { marginTop: space.md },
  footer: { alignItems: 'center', marginTop: space.xl },
});
