/**
 * Root layout — composes the global providers and the role-gating router.
 *
 * Provider order (outer → inner):
 *   GestureHandlerRootView → SafeAreaProvider → QueryClientProvider
 *     → LocaleProvider (RTL/I18nManager) → AuthProvider → <RootNavigator/>
 *
 * The Supabase client is a module singleton (lib/supabase) consumed by Auth +
 * data hooks. Push registration fires once a session + profile exist.
 */
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';

import { queryClient } from '../lib/queryClient';
import { LocaleProvider } from '../lib/i18n';
import { AuthProvider, useAuth, roleHome } from '../lib/auth';
import { registerForPush } from '../lib/push';
import { Loader } from '../components/Loader';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LocaleProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </LocaleProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Gates navigation by auth + role. Redirects:
 *  - unauthenticated → (auth)
 *  - authenticated   → the role's home group, when sitting in (auth)
 */
function RootNavigator() {
  const { session, profile, role, loading, isConfigured } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Register this device for push once we have an authenticated profile.
  useEffect(() => {
    if (profile?.id) {
      void registerForPush(profile.id);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (loading) return;

    const group = segments[0]; // '(auth)' | '(customer)' | '(driver)' | '(technician)' | undefined
    const inAuthGroup = group === '(auth)';
    // When backend is unconfigured we still let the user into the storefront
    // (customer) so the sample-data experience is reachable for demos.
    const authed = Boolean(session) || !isConfigured;

    if (!authed && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (authed && inAuthGroup) {
      const home = isConfigured ? roleHome(role) : '/(customer)';
      router.replace(home as never);
    }
  }, [loading, session, role, segments, isConfigured, router]);

  if (loading) {
    return <Loader label="…" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(driver)" />
      <Stack.Screen name="(technician)" />
    </Stack>
  );
}
