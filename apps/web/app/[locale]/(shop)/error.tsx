'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@elite/ui/web';
import { useT } from '@/lib/use-t';

/** Storefront error boundary — keeps a failed data read from blanking the app. */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <EmptyState
        title={t('common.error')}
        description={t('common.errorTryAgain')}
        action={<Button onClick={reset}>{t('common.retry')}</Button>}
      />
    </div>
  );
}
