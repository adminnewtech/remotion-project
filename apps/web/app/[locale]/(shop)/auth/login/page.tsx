'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth } from '@elite/core';
import { Button, Input } from '@elite/ui/web';
import { useSupabase } from '@/components/providers';
import { useT } from '@/lib/use-t';

type Phase = 'phone' | 'otp';

export default function LoginPage() {
  const { t, locale } = useT();
  const supabase = useSupabase();
  const router = useRouter();
  const base = `/${locale}`;

  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('+965');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const validPhone = /^\+965\d{8}$/.test(phone.replace(/\s/g, ''));

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
      router.push(`${base}/account`);
    } catch {
      setError(t('auth.invalidOtp'));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">E</span>
          <h1 className="text-xl font-bold">{phase === 'phone' ? t('auth.welcome') : t('auth.otpTitle')}</h1>
          <p className="mt-1 text-sm text-muted">
            {phase === 'phone' ? t('auth.termsAgree') : t('auth.otpSubtitle', { phone })}
          </p>
        </div>

        {phase === 'phone' ? (
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
