/**
 * StaffProfile — shared profile + availability screen body for driver and
 * technician roles. Online/offline toggle, assigned zone, language switch,
 * sign-out.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from './Screen';
import { AppText } from './Text';
import { AppCard } from './AppCard';
import { Avatar } from './Avatar';
import { AppButton } from './AppButton';
import { Toggle } from './Toggle';
import { StatusPill } from './StatusPill';
import { useAuth } from '../lib/auth';
import { useLocale } from '../lib/i18n';
import { space } from '../lib/palette';

interface StaffProfileProps {
  /** 'driver' | 'technician' — affects the labels shown. */
  kind: 'driver' | 'technician';
  zone?: string;
}

export function StaffProfile({ kind, zone = 'Salmiya' }: StaffProfileProps) {
  const { t, locale, toggleLocale } = useLocale();
  const { profile, role, signOut, isConfigured } = useAuth();
  const [online, setOnline] = useState(true);

  return (
    <Screen scroll>
      <AppCard style={styles.header}>
        <Avatar name={profile?.full_name ?? '?'} uri={profile?.avatar_url} size={64} />
        <View style={styles.headerText}>
          <AppText variant="subtitle" weight="700">
            {profile?.full_name ?? t('common.appName')}
          </AppText>
          <AppText tone="muted" variant="caption">
            {role ? t(`roles.${role}`) : t(`roles.${kind}`)}
          </AppText>
        </View>
        <StatusPill tone={online ? 'success' : 'neutral'} label={online ? '● Online' : '○ Offline'} />
      </AppCard>

      <AppCard style={styles.section}>
        <Toggle
          label={online ? '● Online' : '○ Offline'}
          description={t('common.today')}
          value={online}
          onValueChange={setOnline}
        />
      </AppCard>

      <AppCard style={styles.section}>
        <View style={styles.row}>
          <AppText tone="muted">{t('admin.assignZone')}</AppText>
          <AppText weight="700">{zone}</AppText>
        </View>
      </AppCard>

      <AppButton
        title={locale === 'ar' ? 'English' : 'العربية'}
        variant="ghost"
        style={styles.section}
        onPress={toggleLocale}
      />

      {isConfigured ? (
        <AppButton title={t('auth.logout')} variant="outline" style={styles.section} onPress={signOut} />
      ) : (
        <AppText variant="caption" tone="muted" center style={styles.section}>
          Demo mode — backend not configured.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginStart: space.md, flex: 1 },
  section: { marginTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
