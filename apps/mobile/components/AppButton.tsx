/**
 * AppButton — the primary action control. Variants map to the brand palette;
 * supports loading + disabled states and a full-width default suited to mobile.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { palette, radii, space, fontSizes } from '../lib/palette';
import { AppText } from './Text';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface AppButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
}

const HEIGHTS: Record<Size, number> = { sm: 40, md: 48, lg: 56 };
const FONT: Record<Size, number> = { sm: fontSizes.sm, md: fontSizes.base, lg: fontSizes.lg };

export function AppButton({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  leftIcon,
  disabled,
  style,
  ...rest
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const v = VARIANTS[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size], backgroundColor: v.bg, borderColor: v.border },
        v.bordered ? styles.bordered : null,
        fullWidth ? styles.fullWidth : styles.auto,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <AppText weight="600" center style={{ color: v.fg, fontSize: FONT[size] }}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<
  Variant,
  { bg: string; fg: string; border: string; bordered?: boolean }
> = {
  primary: { bg: palette.primary, fg: palette.primaryFg, border: palette.primary },
  accent: { bg: palette.accent, fg: palette.accentFg, border: palette.accent },
  danger: { bg: palette.danger, fg: '#ffffff', border: palette.danger },
  success: { bg: palette.success, fg: '#ffffff', border: palette.success },
  outline: { bg: 'transparent', fg: palette.primary, border: palette.primary, bordered: true },
  ghost: { bg: 'transparent', fg: palette.primary, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  bordered: { borderWidth: 1.5 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginEnd: space.sm },
  fullWidth: { alignSelf: 'stretch' },
  auto: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
});
