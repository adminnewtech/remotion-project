/**
 * Technician tab navigator. Tabs: Jobs, Profile/availability.
 * The active-job screen is stacked (launched from the jobs list).
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { palette } from '../../lib/palette';
import { useLocale } from '../../lib/i18n';
import { TabIcon } from '../../components/TabIcon';

export default function TechnicianLayout() {
  const { t } = useLocale();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.neutral400,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.jobs'), tabBarIcon: (p) => <TabIcon glyph="🔧" {...p} /> }}
      />
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{ title: t('nav.profile'), tabBarIcon: (p) => <TabIcon glyph="👤" {...p} /> }}
      />
    </Tabs>
  );
}
