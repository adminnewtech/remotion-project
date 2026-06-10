'use client';

/**
 * Browser-side Supabase client (singleton). Built from the @elite/core factory
 * so web and mobile share one typed client. Returns `null` when env is absent
 * so callers can fall back to sample data without crashing.
 */
import { createClientFromEnv, type EliteClient } from '@elite/core';
import { PUBLIC_ENV, hasSupabaseEnv } from '@/lib/env';

let cached: EliteClient | null = null;

export function getBrowserClient(): EliteClient | null {
  if (!hasSupabaseEnv) return null;
  if (cached) return cached;
  cached = createClientFromEnv(
    { url: PUBLIC_ENV.supabaseUrl, anonKey: PUBLIC_ENV.supabaseAnonKey },
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
  return cached;
}
