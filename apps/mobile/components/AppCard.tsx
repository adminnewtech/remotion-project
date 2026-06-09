/**
 * AppCard — elevated surface container used for list rows, product tiles and
 * panels. Optionally pressable (renders as a button).
 */
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, radii, space } from '../lib/palette';
import { shadows } from '../lib/theme';

interface AppCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: ViewStyle;
}

export function AppCard({ children, onPress, padded = true, elevated = true, style }: AppCardProps) {
  const cardStyle = [
    styles.card,
    padded ? styles.padded : null,
    elevated ? shadows.sm : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed ? styles.pressed : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  padded: { padding: space.md },
  pressed: { opacity: 0.9 },
});
