import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { CartProvider } from '@/components/cart-store';
import { AuthProvider } from '@/components/auth-context';
import { fetchCategories } from '@/lib/data';

/** Storefront shell: header (with categories) + footer, wrapped in cart/auth. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const categories = await fetchCategories();
  return (
    <AuthProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col">
          <Header categories={categories} />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
