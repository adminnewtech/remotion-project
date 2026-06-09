/**
 * Driver tab navigator. Tabs: Tasks, Active delivery, Profile/availability.
 * Proof-of-delivery is a stacked screen launched from the active delivery.
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { palette } from '../../lib/palette';
import { useLocale } from '../../lib/i18n';
import { TabIcon } from '../../components/TabIcon';

export default function DriverLayout() {
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
        options={{ title: t('nav.tasks'), tabBarIcon: (p) => <TabIcon glyph="📋" {...p} /> }}
      />
      <Tabs.Screen
        name="active/[id]"
        options={{ title: t('nav.deliveries'), href: null }}
      />
      <Tabs.Screen
        name="pod/[id]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('nav.profile'), tabBarIcon: (p) => <TabIcon glyph="👤" {...p} /> }}
      />
    </Tabs>
  );
}
