import { NextResponse, type NextRequest } from 'next/server';

/**
 * Locale gate. Any request whose first path segment isn't a supported locale
 * is redirected to the default Arabic locale (Arabic-first). Static assets,
 * Next internals and files with extensions are skipped.
 */
const LOCALES = ['ar', 'en'];
const DEFAULT_LOCALE = 'ar';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split('/')[1] ?? '';
  if (LOCALES.includes(seg)) return NextResponse.next();

  // Prefer the visitor's saved locale cookie, else default to Arabic.
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
  const locale = LOCALES.includes(cookieLocale ?? '') ? (cookieLocale as string) : DEFAULT_LOCALE;
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and anything with a file extension.
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
