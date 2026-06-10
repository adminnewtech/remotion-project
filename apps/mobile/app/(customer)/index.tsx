/**
 * Customer Home — greeting, category grid, and a featured products rail.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, AppText, AppCard, ProductCard, Loader } from '../../components';
import { useCategories, useProducts } from '../../lib/hooks';
import { tileDisplay } from '../../lib/product';
import { useLocale } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { palette, radii, space } from '../../lib/palette';

export default function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { profile } = useAuth();
  const categories = useCategories();
  const products = useProducts();

  return (
    <Screen scroll refreshing={products.isFetching} onRefresh={() => products.refetch()}>
      <View style={styles.hero}>
        <AppText tone="muted">{t('auth.welcomeBack')}</AppText>
        <AppText variant="title" weight="700">
          {profile?.full_name ?? t('common.appName')}
        </AppText>
      </View>

      {/* Search entry */}
      <AppCard onPress={() => router.push('/(customer)/catalog')} style={styles.search}>
        <View style={styles.searchRow}>
          <AppText style={styles.searchIcon}>🔍</AppText>
          <AppText tone="muted">{t('catalog.searchPlaceholder')}</AppText>
        </View>
      </AppCard>

      {/* Categories */}
      <SectionHeader title={t('nav.categories')} onSeeAll={() => router.push('/(customer)/catalog')} t={t} />
      {categories.isLoading ? (
        <Loader inline />
      ) : (
        <View style={styles.catGrid}>
          {(categories.data ?? []).map((c) => (
            <Pressable
              key={c.id}
              style={styles.catTile}
              onPress={() => router.push({ pathname: '/(customer)/catalog', params: { categoryId: c.id } })}
            >
              <View style={styles.catIcon}>
                <AppText style={styles.catEmoji}>{categoryEmoji(c.slug)}</AppText>
              </View>
              <AppText variant="caption" center numberOfLines={1}>
                {locale === 'ar' ? c.name_ar : c.name_en}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}

      {/* Featured */}
      <SectionHeader title={t('catalog.featured')} t={t} />
      {products.isLoading ? (
        <Loader inline />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {(products.data ?? []).slice(0, 6).map((p) => {
            const d = tileDisplay(p);
            return (
              <View key={p.id} style={styles.railItem}>
                <ProductCard product={p} price={d.price} compareAt={d.compareAt} imageUrl={d.image} />
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

function SectionHeader({
  title,
  onSeeAll,
  t,
}: {
  title: string;
  onSeeAll?: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading" weight="700">
        {title}
      </AppText>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll}>
          <AppText tone="primary" weight="600">
            {t('common.seeAll')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function categoryEmoji(slug: string): string {
  const map: Record<string, string> = {
    tv: '📺',
    ac: '❄️',
    audio: '🔊',
    home: '🧺',
    phones: '📱',
    laptops: '💻',
  };
  return map[slug] ?? '🛍️';
}

const styles = StyleSheet.create({
  hero: { marginBottom: space.md },
  search: { marginBottom: space.lg },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchIcon: { marginEnd: space.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  catTile: { width: '25%', alignItems: 'center', paddingHorizontal: space.xs, marginBottom: space.md },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  catEmoji: { fontSize: 26 },
  rail: { paddingEnd: space.md },
  railItem: { width: 160, marginEnd: space.md },
});
