/**
 * ProductCard — catalog/home grid tile. Localized name, brand, price (with
 * sale compare-at) and an installation badge for products that need it.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Product } from '@elite/types';
import { palette, radii, space } from '../lib/palette';
import { useLocale } from '../lib/i18n';
import { AppCard } from './AppCard';
import { AppText } from './Text';
import { PriceText } from './PriceText';

interface ProductCardProps {
  product: Product;
  /** Lowest variant price (resolved by the screen). */
  price: number;
  compareAt?: number | null;
  imageUrl?: string | null;
}

export function ProductCard({ product, price, compareAt, imageUrl }: ProductCardProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const name = locale === 'ar' ? product.name_ar : product.name_en;

  return (
    <AppCard padded={false} style={styles.card} onPress={() => router.push(`/(customer)/product/${product.slug}`)}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <AppText tone="muted">📷</AppText>
          </View>
        )}
        {product.requires_installation ? (
          <View style={styles.badge}>
            <AppText variant="caption" weight="700" style={styles.badgeText}>
              {t('product.buyAndInstall')}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {product.brand ? (
          <AppText variant="caption" tone="muted">
            {product.brand}
          </AppText>
        ) : null}
        <AppText weight="600" numberOfLines={2} style={styles.name}>
          {name}
        </AppText>
        <View style={styles.price}>
          <PriceText amount={price} compareAt={compareAt} size="sm" tone="primary" />
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1, backgroundColor: palette.neutral100 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: space.sm,
    insetInlineStart: space.sm,
    backgroundColor: palette.accent,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: palette.accentFg },
  body: { padding: space.sm },
  name: { marginTop: 2, minHeight: 38 },
  price: { marginTop: space.xs },
});
