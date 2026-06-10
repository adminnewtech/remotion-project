import type { ReactNode } from 'react';
import './globals.css';

/**
 * Root layout. The real <html>/<body> with lang+dir is rendered by the
 * locale layout under app/[locale]; this passthrough keeps Next happy for the
 * root segment and the locale redirect page.
 */
export const metadata = {
  title: 'Elite — Newtech',
  description: 'Electronics, professional installation & fast delivery in Kuwait.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
