'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '@elite/core';
import { Button, Input } from '@elite/ui/web';
import { useSupabase } from '@/components/providers';
import { useT } from '@/lib/use-t';

type Method = 'phone' | 'email';
type Phase = 'phone' | 'otp';

export default function LoginPage() {
  const { t, locale } = useT();
  const isAr = locale === 'ar';
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const base = `/${locale}`;

  const [method, setMethod] = useState<Method>('phone');

  // Phone / OTP state
  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('+965');
  const [code, setCode] = useState('');

  // Email / password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const validPhone = /^\+965\d{8}$/.test(phone.replace(/\s/g, ''));
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /** Mirror existing post-login routing, lifting staff/admin into the admin app. */
  async function routeAfterLogin() {
    let dest = `${base}/account`;
    try {
      const profile = supabase ? await auth.getProfile(supabase) : null;
      const next = searchParams.get('next');
      if (profile && (profile.role === 'admin' || profile.role === 'employee')) {
        dest = `${base}/admin`;
      } else if (next === 'admin') {
        // Non-staff redirected here from an admin gate: send to account.
        dest = `${base}/account`;
      }
    } catch {
      // Fall back to account on any profile lookup failure.
    }
    router.push(dest);
  }

  function switchMethod(next: Method) {
    setMethod(next);
    setError(null);
    setResetNotice(null);
  }

  async function sendCode() {
    setError(null);
    if (!validPhone) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setBusy(true);
    try {
      if (supabase) await auth.signInWithOtp(supabase, phone.replace(/\s/g, ''));
      setPhase('otp');
      setResendIn(60);
    } catch {
      setError(t('auth.invalidPhone'));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      if (supabase) await auth.verifyOtp(supabase, phone.replace(/\s/g, ''), code);
      await routeAfterLogin();
    } catch {
      setError(t('auth.invalidOtp'));
      setBusy(false);
    }
  }

  async function signInEmail() {
    setError(null);
    setResetNotice(null);
    if (!validEmail) {
      setError(isAr ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }
    if (!password) {
      setError(isAr ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      return;
    }
    setBusy(true);
    try {
      if (supabase) await auth.signInWithPassword(supabase, email.trim(), password);
      await routeAfterLogin();
    } catch {
      setError(
        isAr
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : 'Invalid email or password',
      );
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    setResetNotice(null);
    if (!validEmail) {
      setError(
        isAr
          ? 'أدخل بريدك الإلكتروني أولاً لإعادة تعيين كلمة المرور'
          : 'Enter your email first to reset your password',
      );
      return;
    }
    setBusy(true);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}${base}/auth/login` : undefined;
      if (supabase) await auth.resetPasswordForEmail(supabase, email.trim(), redirectTo);
      setResetNotice(
        isAr
          ? 'إذا كان هذا البريد مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.'
          : 'If that email is registered, a reset link is on its way.',
      );
    } catch {
      // Avoid leaking whether an email exists — show the same neutral notice.
      setResetNotice(
        isAr
          ? 'إذا كان هذا البريد مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.'
          : 'If that email is registered, a reset link is on its way.',
      );
    } finally {
      setBusy(false);
    }
  }

  const phoneTabLabel = isAr ? 'هاتف (OTP)' : 'Phone';
  const emailTabLabel = isAr ? 'البريد الإلكتروني' : 'Email';
  const heading =
    method === 'phone' && phase === 'otp' ? t('auth.otpTitle') : t('auth.welcome');
  const subheading =
    method === 'phone' && phase === 'otp'
      ? t('auth.otpSubtitle', { phone })
      : t('auth.termsAgree');

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">
            E
          </span>
          <h1 className="text-xl font-bold">{heading}</h1>
          <p className="mt-1 text-sm text-muted">{subheading}</p>
        </div>

        {/* Method segmented control — hidden mid-OTP to keep the flow focused. */}
        {!(method === 'phone' && phase === 'otp') && (
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => switchMethod('phone')}
              aria-pressed={method === 'phone'}
              className={
                'rounded-xl px-3 py-2 text-sm font-semibold transition ' +
                (method === 'phone'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground')
              }
            >
              {phoneTabLabel}
            </button>
            <button
              type="button"
              onClick={() => switchMethod('email')}
              aria-pressed={method === 'email'}
              className={
                'rounded-xl px-3 py-2 text-sm font-semibold transition ' +
                (method === 'email'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground')
              }
            >
              {emailTabLabel}
            </button>
          </div>
        )}

        {method === 'phone' ? (
          phase === 'phone' ? (
            <div className="space-y-4">
              <Input
                label={t('auth.phone')}
                type="tel"
                dir="ltr"
                placeholder={t('auth.phonePlaceholder')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={error ?? undefined}
              />
              <Button className="w-full" loading={busy} onClick={sendCode}>
                {t('auth.sendCode')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                label={t('auth.otpTitle')}
                inputMode="numeric"
                dir="ltr"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                error={error ?? undefined}
                className="text-center text-2xl tracking-[0.5em]"
              />
              <Button className="w-full" loading={busy} onClick={verify} disabled={code.length < 4}>
                {t('auth.verify')}
              </Button>
              <button
                type="button"
                disabled={resendIn > 0}
                onClick={sendCode}
                className="w-full text-sm text-muted hover:text-primary disabled:opacity-50"
              >
                {resendIn > 0 ? t('auth.otpResendIn', { seconds: resendIn }) : t('auth.otpResend')}
              </button>
            </div>
          )
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void signInEmail();
            }}
          >
            <Input
              label={t('auth.email')}
              type="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error ?? undefined}
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-xs font-medium text-muted hover:text-primary"
                  aria-label={
                    showPassword
                      ? isAr
                        ? 'إخفاء كلمة المرور'
                        : 'Hide password'
                      : isAr
                        ? 'إظهار كلمة المرور'
                        : 'Show password'
                  }
                >
                  {showPassword
                    ? isAr
                      ? 'إخفاء'
                      : 'Hide'
                    : isAr
                      ? 'إظهار'
                      : 'Show'}
                </button>
              }
            />

            {resetNotice && (
              <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">{resetNotice}</p>
            )}

            <Button type="submit" className="w-full" loading={busy}>
              {t('auth.login')}
            </Button>

            <button
              type="button"
              onClick={forgotPassword}
              disabled={busy}
              className="w-full text-sm text-muted hover:text-primary disabled:opacity-50"
            >
              {t('auth.forgotPassword')}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        <button onClick={() => router.push(base)} className="hover:text-primary">
          {t('auth.continueAsGuest')}
        </button>
      </p>
    </div>
  );
}
