import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { coerceLocale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function CartClaimPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale: rawLocale, token } = await params;
  const locale = coerceLocale(rawLocale);

  const sb = await getServerClient();
  const { data: authData } = (await sb?.auth.getUser()) ?? { data: { user: null } };
  const user = authData?.user ?? null;

  if (!user) {
    // Not authenticated — send to login with a redirect back here after sign-in.
    const returnPath = `/${locale}/cart/claim/${token}`;
    redirect(`/${locale}/auth/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  // Authenticated — claim the cart then send to /cart.
  await sb?.rpc('claim_cart_by_token', { p_token: token, p_user_id: user.id });

  redirect(`/${locale}/cart`);
}

// Fallback UI shown while the server component resolves (rare, but keeps the
// page meaningful if the redirect takes a moment to fire on a slow connection).
export function generateMetadata() {
  return { title: 'جاري تجهيز سلة التسوق…' };
}
