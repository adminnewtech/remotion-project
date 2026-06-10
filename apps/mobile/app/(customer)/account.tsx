/**
 * Account — profile header, language switch, links (orders, addresses,
 * support, notifications), and sign-out.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, AppCard, Avatar, AppButton } from '../../components';
import { useAuth } from '../../lib/auth';
import { useLocale } from '../../lib/i18n';
import { palette, space } from '../../lib/palette';

export default function AccountScreen() {
  const router = useRouter();
  const { t, locale, toggleLocale } = useLocale();
  const { profile, role, signOut, isConfigured } = useAuth();

  const links: { icon: string; label: string; onPress: () => void }[] = [
    { icon: '📦', label: t('nav.orders'), onPress: () => router.push('/(customer)/orders') },
    { icon: '💬', label: t('nav.support'), onPress: () => router.push('/(customer)/support') },
    { icon: '🌐', label: locale === 'ar' ? 'English' : 'العربية', onPress: toggleLocale },
  ];

  return (
    <Screen scroll>
      <AppCard style={styles.header}>
        <Avatar name={profile?.full_name ?? '?'} uri={profile?.avatar_url} size={64} />
        <View style={styles.headerText}>
          <AppText variant="subtitle" weight="700">
            {profile?.full_name ?? t('common.appName')}
          </AppText>
          <AppText tone="muted" variant="caption">
            {profile?.phone ?? ''}
          </AppText>
          {role ? (
            <AppText variant="caption" tone="primary">
              {t(`roles.${role}`)}
            </AppText>
          ) : null}
        </View>
      </AppCard>

      <View style={styles.links}>
        {links.map((l) => (
          <Pressable key={l.label} style={styles.linkRow} onPress={l.onPress}>
            <AppText style={styles.linkIcon}>{l.icon}</AppText>
            <AppText weight="600" style={styles.linkLabel}>
              {l.label}
            </AppText>
            <AppText tone="muted">›</AppText>
          </Pressable>
        ))}
      </View>

      {isConfigured ? (
        <AppButton title={t('auth.logout')} variant="outline" style={styles.logout} onPress={signOut} />
      ) : (
        <AppText variant="caption" tone="muted" center style={styles.demo}>
          Demo mode — backend not configured.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { marginStart: space.md, flex: 1 },
  links: { marginTop: space.lg },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  linkIcon: { marginEnd: space.md },
  linkLabel: { flex: 1 },
  logout: { marginTop: space.xl },
  demo: { marginTop: space.xl },
});
