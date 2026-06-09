import 'server-only';

/**
 * Server-side Supabase client for React Server Components and route handlers.
 * Uses the anon key + the request cookies so RLS sees the signed-in user.
 * Returns `null` when env is absent → callers fall back to sample data.
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { EliteClient } from '@elite/core';
import type { Database } from '@elite/types/database';
import { PUBLIC_ENV, hasSupabaseEnv } from '@/lib/env';

export async function getServerClient(): Promise<EliteClient | null> {
  if (!hasSupabaseEnv) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(
    PUBLIC_ENV.supabaseUrl,
    PUBLIC_ENV.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          // RSC can't always set cookies; ignore failures (middleware refreshes).
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  ) as unknown as EliteClient;
}
