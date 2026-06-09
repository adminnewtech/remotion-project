/**
 * Auth context — phone-OTP session + profile, role-aware.
 *
 * Backed by @elite/core auth helpers (signInWithOtp / verifyOtp / getProfile /
 * onAuthChange) and the mobile Supabase client. Exposes the signed-in profile
 * (with `role`) so the router can gate users into the right role stack.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  signInWithOtp as coreSignInWithOtp,
  verifyOtp as coreVerifyOtp,
  getProfile as coreGetProfile,
  signOut as coreSignOut,
  onAuthChange,
} from '@elite/core';
import type { Profile, UserRole } from '@elite/types';
import { getSupabase } from './supabase';

interface AuthContextValue {
  /** undefined = still loading, null = signed out, object = signed in. */
  session: Session | null | undefined;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  /** Backend is configured (vs. sample-data / unconfigured build). */
  isConfigured: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(
    client ? undefined : null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(client));

  const loadProfile = useCallback(async () => {
    if (!client) {
      setProfile(null);
      return;
    }
    const p = await coreGetProfile(client);
    setProfile(p);
  }, [client]);

  // Initial session + subscribe to auth changes.
  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile();
      setLoading(false);
    })();

    const sub = onAuthChange(client, async (next) => {
      setSession(next);
      if (next) {
        await loadProfile();
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [client, loadProfile]);

  const sendOtp = useCallback(
    async (phone: string) => {
      if (!client) throw new Error('Auth unavailable: backend not configured.');
      await coreSignInWithOtp(client, normalizePhone(phone));
    },
    [client],
  );

  const verifyOtp = useCallback(
    async (phone: string, token: string) => {
      if (!client) throw new Error('Auth unavailable: backend not configured.');
      const { session: next } = await coreVerifyOtp(client, normalizePhone(phone), token);
      setSession(next);
      await loadProfile();
    },
    [client, loadProfile],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await coreSignOut(client);
    setSession(null);
    setProfile(null);
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      isConfigured: Boolean(client),
      sendOtp,
      verifyOtp,
      refreshProfile: loadProfile,
      signOut,
    }),
    [session, profile, loading, client, sendOtp, verifyOtp, loadProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Map a role to its expo-router route group segment. */
export function roleHome(role: UserRole | null): string {
  switch (role) {
    case 'driver':
      return '/(driver)';
    case 'technician':
      return '/(technician)';
    // employee/admin manage via web; in-app they get the customer storefront.
    case 'customer':
    case 'employee':
    case 'admin':
    default:
      return '/(customer)';
  }
}

/** Kuwait-friendly normalization: bare 8-digit numbers get +965. */
function normalizePhone(input: string): string {
  const trimmed = input.replace(/\s+/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  if (/^965\d{8}$/.test(trimmed)) return `+${trimmed}`;
  if (/^\d{8}$/.test(trimmed)) return `+965${trimmed}`;
  return trimmed;
}
