/**
 * Authentication helpers — phone OTP is the primary flow in Kuwait.
 */
import type { Session, Subscription, User } from '@supabase/supabase-js';
import type { Profile } from '@elite/types';
import type { EliteClient } from './client';

/** Send a one-time password to a phone number (E.164, e.g. +965XXXXXXXX). */
export async function signInWithOtp(client: EliteClient, phone: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Verify the SMS OTP code, establishing a session on success. */
export async function verifyOtp(
  client: EliteClient,
  phone: string,
  token: string,
): Promise<{ session: Session | null; user: User | null }> {
  const { data, error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return { session: data.session, user: data.user };
}

/** Sign the current user out. */
export async function signOut(client: EliteClient): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/**
 * Fetch the signed-in user's profile row, or `null` if not authenticated.
 * RLS guarantees a user only ever reads their own profile here.
 */
export async function getProfile(client: EliteClient): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export type AuthChangeCallback = (session: Session | null) => void;

/**
 * Subscribe to auth state changes. Returns the subscription so callers can
 * `.unsubscribe()` on teardown (useEffect cleanup, etc.).
 */
export function onAuthChange(client: EliteClient, cb: AuthChangeCallback): Subscription {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => cb(session));
  return subscription;
}
