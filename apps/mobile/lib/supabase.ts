/**
 * Supabase client singleton for the mobile app.
 *
 * Built via @elite/core's `createClientFromEnv` so web and mobile share one
 * client factory. Mobile-specific bits: AsyncStorage-backed auth persistence
 * and the url-polyfill required by supabase-js on React Native.
 *
 * When the backend env is absent (`hasLiveBackend === false`) we return null
 * and the data layer falls back to sample data behind explicit guards.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClientFromEnv, type EliteClient } from '@elite/core';
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasLiveBackend } from './env';

let cached: EliteClient | null = null;

export function getSupabase(): EliteClient | null {
  if (!hasLiveBackend) return null;
  if (cached) return cached;

  cached = createClientFromEnv(
    { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY },
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // RN has no URL bar; OTP/session is not derived from the URL.
        detectSessionInUrl: false,
      },
    },
  );
  return cached;
}

/**
 * Like `getSupabase` but throws when no client is available. Use in mutation
 * paths (checkout, task updates) where running without a backend is a bug.
 */
export function requireSupabase(): EliteClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase client unavailable: set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return client;
}
