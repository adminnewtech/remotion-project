/**
 * Product detail — media gallery, variant selector, Buy+Install toggle,
 * specs/description, add-to-cart. Pricing reflects the selected variant.
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { formatKWD } from '../../../lib/theme';
import {
  Screen,
  AppText,
  AppButton,
  AppCard,
  PriceText,
  Toggle,
  Loader,
  EmptyState,
} from '../../../components';
import { useProduct } from '../../../lib/hooks';
import { useCart } from '../../../lib/cart';
import { useLocale } from '../../../lib/i18n';
import { palette, radii, space } from '../../../lib/palette';

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { add } = useCart();
  const { data: product, isLoading } = useProduct(String(slug));

  const [variantId, setVariantId] = useState<string | null>(null);
  const [withInstall, setWithInstall] = useState(false);
  const [added, setAdded] = useState(false);

  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null,
    [product, variantId],
  );

  if (isLoading) return <Loader label={t('common.loading')} />;
  if (!product) return <EmptyState icon="❓" title={t('common.notFound')} />;

  const name = locale === 'ar' ? product.name_ar : product.name_en;
  const description = locale === 'ar' ? product.description_ar : product.description_en;
  const price = variant ? variant.sale_price ?? variant.price : 0;
  const compareAt = variant?.sale_price != null ? variant.price : null;

  const onAdd = async () => {
    if (!variant) return;
    await add({
      variant: { id: variant.id, price: variant.price, sale_price: variant.sale_price, product_id: product.id },
      product: { id: product.id, installation_fee: product.installation_fee },
      qty: 1,
      withInstallation: withInstall,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: name }} />
      <Screen padded={false} scroll>
        {/* Gallery */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(product.media.length ? product.media : [null]).map((m, i) => (
            <View key={m?.id ?? i} style={styles.gallerySlide}>
              {m ? (
                <Image source={{ uri: m.url }} style={styles.galleryImage} resizeMode="cover" />
              ) : (
                <View style={[styles.galleryImage, styles.placeholder]}>
                  <AppText tone="muted">📷</AppText>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.body}>
          {product.brand ? <AppText tone="muted">{product.brand}</AppText> : null}
          <AppText variant="title" weight="700" style={styles.name}>
            {name}
          </AppText>
          <PriceText amount={price} compareAt={compareAt} size="lg" tone="primary" />

          {/* Variant selector */}
          {product.variants.length > 1 ? (
            <View style={styles.section}>
              <AppText variant="label" tone="muted">
                {t('product.selectVariant')}
              </AppText>
              <View style={styles.variantRow}>
                {product.variants.map((v) => {
                  const active = v.id === variant?.id;
                  const label = Object.values(v.attributes).join(' · ') || v.sku || '—';
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setVariantId(v.id)}
                      style={[styles.variantChip, active ? styles.variantChipActive : null]}
                    >
                      <AppText
                        variant="caption"
                        weight="600"
                        style={{ color: active ? palette.primaryFg : palette.foreground }}
                      >
                        {label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Buy + Install toggle */}
          {product.requires_installation ? (
            <AppCard style={styles.section}>
              <Toggle
                label={t('product.buyAndInstall')}
                description={`${t('product.installationFee')}: ${formatKWD(product.installation_fee)}`}
                value={withInstall}
                onValueChange={setWithInstall}
              />
            </AppCard>
          ) : null}

          {/* Warranty */}
          <View style={styles.warranty}>
            <AppText>🛡️ {t('product.warranty', { months: product.warranty_months })}</AppText>
          </View>

          {/* Description */}
          {description ? (
            <View style={styles.section}>
              <AppText variant="heading" weight="700" style={styles.sectionTitle}>
                {t('product.description')}
              </AppText>
              <AppText tone="muted">{description}</AppText>
            </View>
          ) : null}

          {/* Specs */}
          {variant && Object.keys(variant.attributes).length > 0 ? (
            <View style={styles.section}>
              <AppText variant="heading" weight="700" style={styles.sectionTitle}>
                {t('product.specifications')}
              </AppText>
              {Object.entries(variant.attributes).map(([k, v]) => (
                <View key={k} style={styles.specRow}>
                  <AppText tone="muted">{k}</AppText>
                  <AppText weight="600">{v}</AppText>
                </View>
              ))}
              {variant.sku ? (
                <View style={styles.specRow}>
                  <AppText tone="muted">{t('product.sku')}</AppText>
                  <AppText weight="600">{variant.sku}</AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Screen>

      {/* Sticky add-to-cart bar */}
      <View style={styles.bar}>
        <View style={styles.barPrice}>
          <PriceText amount={withInstall ? price + product.installation_fee : price} size="md" />
        </View>
        <View style={styles.barBtn}>
          <AppButton
            title={added ? `✓ ${t('product.addToCart')}` : t('product.addToCart')}
            variant={added ? 'success' : 'primary'}
            onPress={onAdd}
          />
        </View>
        <View style={styles.barBtn}>
          <AppButton title={t('cart.checkout')} variant="outline" onPress={() => router.push('/(customer)/cart')} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  gallerySlide: { width: 360, maxWidth: '100%' },
  galleryImage: { width: '100%', aspectRatio: 1, backgroundColor: palette.neutral100 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.md },
  name: { marginVertical: space.xs },
  section: { marginTop: space.lg },
  sectionTitle: { marginBottom: space.sm },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  variantChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.md,
    backgroundColor: palette.neutral100,
    marginEnd: space.sm,
    marginBottom: space.sm,
  },
  variantChipActive: { backgroundColor: palette.primary },
  warranty: { marginTop: space.md },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    backgroundColor: palette.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  barPrice: { marginEnd: space.md },
  barBtn: { flex: 1, marginStart: space.sm },
});
