/**
 * Runtime environment resolution for the Elite mobile app.
 *
 * Values come from Expo public env vars (EXPO_PUBLIC_*) which are inlined at
 * build time, with a fallback to `expo-constants` extra (populated from the
 * same vars in app.json). When neither is present we are running without a
 * live backend — `hasLiveBackend` is false and screens fall back to clearly
 * marked sample data.
 */
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function read(envValue: string | undefined, extraValue: string | undefined): string {
  const v = envValue ?? extraValue ?? '';
  // app.json placeholders like "$EXPO_PUBLIC_SUPABASE_URL" mean "unset".
  return v.startsWith('$') ? '' : v;
}

export const SUPABASE_URL = read(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  extra.supabaseUrl,
);

export const SUPABASE_ANON_KEY = read(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  extra.supabaseAnonKey,
);

export const MAPS_API_KEY = read(
  process.env.EXPO_PUBLIC_MAPS_API_KEY,
  extra.mapsApiKey,
);

/**
 * True only when both Supabase URL + anon key are present. Used to guard the
 * sample-data fallbacks so they never ship in a configured build.
 */
export const hasLiveBackend = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
