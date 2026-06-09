'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { UserRole } from '@elite/types';
import { Spinner } from '@elite/ui/web';
import { useAuth, hasRole } from '@/components/auth-context';
import { useLocale } from '@/components/providers';
import { useT } from '@/lib/use-t';

/**
 * Gates children behind a set of allowed roles. While the profile resolves it
 * shows a spinner; if the user lacks access it redirects to login. RLS in the
 * database is the real boundary — this is UX, not security.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: UserRole[];
  children: ReactNode;
}) {
  const { profile, loading } = useAuth();
  const { locale } = useLocale();
  const { t } = useT();
  const router = useRouter();
  const allowed = hasRole(profile, allow);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace(`/${locale}/auth/login?next=admin`);
    }
  }, [loading, allowed, router, locale]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">{t('common.error')}</p>
        <p className="text-sm text-muted">{t('auth.sessionExpired')}</p>
      </div>
    );
  }

  return <>{children}</>;
}
