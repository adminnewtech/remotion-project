/**
 * Public env access for the web app. Only NEXT_PUBLIC_* values are safe to
 * read on the client. When the Supabase env is absent (e.g. fresh checkout
 * with no .env), `hasSupabaseEnv` is false and the app falls back to sample
 * data so pages still render in dev.
 */
export const PUBLIC_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapsApiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY ?? '',
} as const;

export const hasSupabaseEnv: boolean = Boolean(
  PUBLIC_ENV.supabaseUrl && PUBLIC_ENV.supabaseAnonKey,
);
