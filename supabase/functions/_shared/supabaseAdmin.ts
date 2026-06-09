// Elite v1 — shared Supabase clients for Edge Functions.
// Deno runtime.
//
// - getAdminClient(): service-role client for privileged writes (inventory
//   reservation, dispatch, order/payment mutations). NEVER expose to clients.
// - getUserFromRequest(req): validates the caller's JWT and returns their
//   profile identity. Use to bind actions to the authenticated user.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!SUPABASE_URL) {
  console.warn("[supabaseAdmin] SUPABASE_URL is not set");
}

/** Service-role client. Bypasses RLS — only use inside trusted Edge Functions. */
export function getAdminClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AuthedUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  locale: string;
}

/**
 * Validate the caller's JWT from the Authorization header and resolve their
 * profile. Throws if the token is missing/invalid.
 */
export async function getUserFromRequest(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthError("Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();

  // Validate the JWT against Supabase Auth using the anon key.
  const authClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    throw new AuthError("Invalid or expired token");
  }
  const user = data.user;

  // Load profile (role/locale) via service role to avoid RLS recursion.
  const admin = getAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, locale, email, phone")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    phone: profile?.phone ?? user.phone ?? null,
    role: profile?.role ?? "customer",
    locale: profile?.locale ?? "ar",
  };
}

/** Distinguishes auth failures (401) from other errors. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Round to KWD's 3 decimal places (fils). Avoids float drift. */
export function kwd(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}
