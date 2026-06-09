/**
 * Supabase client factory for Elite v1.
 *
 * Platform-agnostic: usable from Next.js (web) and Expo (mobile). Never
 * hardcodes keys — callers pass the URL + anon key (typically from
 * NEXT_PUBLIC_* / EXPO_PUBLIC_* env). The service-role key must NEVER be
 * passed to a client built here; privileged work runs in Edge Functions.
 */
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import type { Database } from '@elite/types/database';

/** The single typed client type the whole package uses. */
export type EliteClient = SupabaseClient<Database>;

export interface EliteEnv {
  url: string;
  anonKey: string;
}

/**
 * Create a typed Supabase client.
 *
 * @param url      Supabase project URL.
 * @param anonKey  Public anon key (safe for clients; RLS enforces access).
 * @param opts     Optional client options (e.g. custom auth storage on mobile).
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  opts?: SupabaseClientOptions<'public'>,
): EliteClient {
  if (!url || !anonKey) {
    throw new Error(
      'createSupabaseClient: both `url` and `anonKey` are required. ' +
        'Provide them from NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        '(or the EXPO_PUBLIC_* equivalents). Never hardcode keys.',
    );
  }
  return createClient<Database>(url, anonKey, opts);
}

/** Convenience wrapper that takes an `{ url, anonKey }` env object. */
export function createClientFromEnv(
  env: EliteEnv,
  opts?: SupabaseClientOptions<'public'>,
): EliteClient {
  return createSupabaseClient(env.url, env.anonKey, opts);
}
