/**
 * AppText — typographic primitive wired to the design tokens. Picks the
 * Arabic-first font family per locale and exposes semantic variants. Use this
 * instead of RN's raw <Text> so type stays consistent and RTL-aware.
 */
import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { palette, fontSizes, fonts } from '../lib/palette';
import { useLocale } from '../lib/i18n';

type Variant = 'display' | 'title' | 'heading' | 'subtitle' | 'body' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'inverse' | 'primary' | 'danger' | 'success';

interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700';
  center?: boolean;
}

const VARIANT_STYLE: Record<Variant, TextStyle> = {
  display: { fontSize: fontSizes['3xl'], fontWeight: '700' },
  title: { fontSize: fontSizes['2xl'], fontWeight: '700' },
  heading: { fontSize: fontSizes.xl, fontWeight: '700' },
  subtitle: { fontSize: fontSizes.lg, fontWeight: '600' },
  body: { fontSize: fontSizes.base, fontWeight: '400' },
  caption: { fontSize: fontSizes.sm, fontWeight: '400' },
  label: { fontSize: fontSizes.sm, fontWeight: '600' },
};

const TONE_COLOR: Record<Tone, string> = {
  default: palette.foreground,
  muted: palette.muted,
  inverse: palette.primaryFg,
  primary: palette.primary,
  danger: palette.danger,
  success: palette.success,
};

export function AppText({
  variant = 'body',
  tone = 'default',
  weight,
  center,
  style,
  ...rest
}: AppTextProps) {
  const { isRTL, locale } = useLocale();
  const family = locale === 'ar' ? fonts.arabic : fonts.latin;
  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        { fontFamily: family, writingDirection: isRTL ? 'rtl' : 'ltr' },
        VARIANT_STYLE[variant],
        { color: TONE_COLOR[tone] },
        weight ? { fontWeight: weight } : null,
        center ? styles.center : null,
        center ? null : { textAlign: isRTL ? 'right' : 'left' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
  center: { textAlign: 'center' },
});
