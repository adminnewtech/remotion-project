/**
 * Field — labelled text input with error + hint support. RTL-aware text
 * alignment driven by the locale.
 */
import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { palette, radii, space, fontSizes, fonts } from '../lib/palette';
import { useLocale } from '../lib/i18n';
import { AppText } from './Text';

interface FieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
}

export function Field({ label, hint, error, containerStyle, style, ...rest }: FieldProps) {
  const { isRTL, locale } = useLocale();
  const [focused, setFocused] = React.useState(false);
  const family = locale === 'ar' ? fonts.arabic : fonts.latin;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="label" tone="muted" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={palette.neutral400}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            fontFamily: family,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
            borderColor: error ? palette.danger : focused ? palette.primary : palette.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.help}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted" style={styles.help}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: space.md },
  label: { marginBottom: space.xs },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: fontSizes.base,
    color: palette.foreground,
    minHeight: 48,
  },
  help: { marginTop: space.xs },
});
