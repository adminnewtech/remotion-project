/**
 * Customer tab navigator. Tabs: Home, Catalog, Cart, Orders, Account.
 * Product detail, checkout, tracking, support and ticket screens are stacked
 * inside this group (rendered above the tabs via headerShown screens).
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { palette } from '../../lib/palette';
import { useLocale } from '../../lib/i18n';
import { CartProvider, useCart } from '../../lib/cart';
import { TabIcon } from '../../components/TabIcon';

export default function CustomerLayout() {
  return (
    <CartProvider>
      <CustomerTabs />
    </CartProvider>
  );
}

function CustomerTabs() {
  const { t } = useLocale();
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.neutral400,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.home'), tabBarIcon: (p) => <TabIcon glyph="🏠" {...p} /> }}
      />
      <Tabs.Screen
        name="catalog"
        options={{ title: t('nav.catalog'), tabBarIcon: (p) => <TabIcon glyph="🛍️" {...p} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('nav.cart'),
          tabBarIcon: (p) => <TabIcon glyph="🛒" {...p} />,
          tabBarBadge: count > 0 ? count : undefined,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: t('nav.orders'), tabBarIcon: (p) => <TabIcon glyph="📦" {...p} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('nav.account'), tabBarIcon: (p) => <TabIcon glyph="👤" {...p} /> }}
      />

      {/* Stacked detail screens — hidden from the tab bar. */}
      <Tabs.Screen name="product/[slug]" options={{ href: null }} />
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      <Tabs.Screen name="track/[id]" options={{ href: null }} />
      <Tabs.Screen name="support/index" options={{ href: null }} />
      <Tabs.Screen name="support/[id]" options={{ href: null }} />
    </Tabs>
  );
}
