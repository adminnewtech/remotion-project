import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE } from '@/lib/i18n';

/** Fallback redirect to the default locale (middleware handles most cases). */
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
