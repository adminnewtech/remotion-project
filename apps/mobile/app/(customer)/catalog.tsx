/**
 * Catalog / Search — text search + category chips, product grid (2 columns).
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, AppText, ProductCard, Field, EmptyState, Loader } from '../../components';
import { useCategories, useProducts } from '../../lib/hooks';
import { tileDisplay } from '../../lib/product';
import { useLocale } from '../../lib/i18n';
import { palette, radii, space } from '../../lib/palette';

export default function CatalogScreen() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { t, locale } = useLocale();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(params.categoryId);

  const categories = useCategories();
  const products = useProducts({ categoryId, search: search.trim() || undefined });

  const data = products.data ?? [];
  const chips = useMemo(() => categories.data ?? [], [categories.data]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Field
          placeholder={t('catalog.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          containerStyle={styles.searchField}
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: undefined, name_ar: 'الكل', name_en: 'All' }, ...chips]}
          keyExtractor={(c) => c.id ?? 'all'}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const active = item.id === categoryId;
            return (
              <Pressable
                onPress={() => setCategoryId(item.id)}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: active ? palette.primaryFg : palette.foreground }}
                >
                  {locale === 'ar' ? item.name_ar : item.name_en}
                </AppText>
              </Pressable>
            );
          }}
        />
      </View>

      {products.isLoading ? (
        <Loader />
      ) : data.length === 0 ? (
        <EmptyState icon="🔍" title={t('catalog.noProducts')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={
            <AppText tone="muted" style={styles.count}>
              {t('catalog.resultsCount', { count: data.length })}
            </AppText>
          }
          renderItem={({ item }) => {
            const d = tileDisplay(item);
            return (
              <View style={styles.cell}>
                <ProductCard product={item} price={d.price} compareAt={d.compareAt} imageUrl={d.image} />
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  searchField: { marginBottom: space.sm },
  chips: { paddingBottom: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radii.full,
    backgroundColor: palette.neutral100,
    marginEnd: space.sm,
  },
  chipActive: { backgroundColor: palette.primary },
  grid: { padding: space.md },
  column: { justifyContent: 'space-between' },
  cell: { width: '48%', marginBottom: space.md },
  count: { marginBottom: space.sm },
});
