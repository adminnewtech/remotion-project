'use client';

/**
 * Auth/profile context for client components.
 *
 * Resolves the signed-in profile via `@elite/core` auth.getProfile when a
 * Supabase client is present. When env is absent (dev / fresh checkout) it
 * exposes a clearly-marked mock admin profile so role-gated UI (the whole
 * admin app) renders without a backend.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { auth } from '@elite/core';
import type { Profile, UserRole } from '@elite/types';
import { useSupabase } from '@/components/providers';
import { hasSupabaseEnv } from '@/lib/env';

const MOCK_ADMIN: Profile = {
  id: 'dev-admin',
  role: 'admin',
  full_name: 'Dev Admin',
  phone: '+96550000000',
  email: 'admin@newtechkw.com',
  avatar_url: null,
  locale: 'ar',
  is_active: true,
  created_at: new Date().toISOString(),
};

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  /** True when running against mock data (no live env). */
  isMock: boolean;
  refresh: () => void;
}

const AuthContext = createContext<AuthState>({
  profile: null,
  loading: true,
  isMock: false,
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useSupabase();
  const [profile, setProfile] = useState<Profile | null>(hasSupabaseEnv ? null : MOCK_ADMIN);
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setProfile(MOCK_ADMIN);
      setLoading(false);
      return;
    }
    setLoading(true);
    auth
      .getProfile(supabase)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, tick]);

  return (
    <AuthContext.Provider
      value={{ profile, loading, isMock: !hasSupabaseEnv, refresh: () => setTick((t) => t + 1) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Convenience: does the current profile satisfy one of the allowed roles? */
export function hasRole(profile: Profile | null, roles: UserRole[]): boolean {
  return !!profile && roles.includes(profile.role);
}
