/**
 * PriceText — renders a KWD amount via the shared `formatKWD` helper, with an
 * optional struck-through "was" price for sale items.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { formatKWD } from '../lib/theme';
import { palette, fontSizes } from '../lib/palette';
import { useLocale } from '../lib/i18n';
import { AppText } from './Text';

interface PriceTextProps {
  amount: number;
  /** Original price; when set and greater than `amount`, shown struck-through. */
  compareAt?: number | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'primary' | 'inverse';
}

const SIZE: Record<NonNullable<PriceTextProps['size']>, number> = {
  sm: fontSizes.sm,
  md: fontSizes.lg,
  lg: fontSizes['2xl'],
};

export function PriceText({ amount, compareAt, size = 'md', tone = 'default' }: PriceTextProps) {
  const { locale } = useLocale();
  const onSale = typeof compareAt === 'number' && compareAt > amount;
  const color =
    tone === 'inverse' ? palette.primaryFg : tone === 'primary' ? palette.primary : palette.foreground;

  return (
    <View style={styles.row}>
      <AppText weight="700" style={{ fontSize: SIZE[size], color }}>
        {formatKWD(amount, locale)}
      </AppText>
      {onSale ? (
        <AppText
          tone="muted"
          style={[styles.compare, { fontSize: SIZE[size] * 0.7 }]}
        >
          {formatKWD(compareAt as number, locale)}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  compare: { marginStart: 8, textDecorationLine: 'line-through' },
});
