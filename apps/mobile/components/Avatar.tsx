/**
 * Avatar — circular user/role badge. Shows the image when available, else
 * initials on a brand-tinted background.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { palette } from '../lib/palette';
import { AppText } from './Text';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
  color?: string;
}

export function Avatar({ name, uri, size = 44, color = palette.primary }: AvatarProps) {
  const radius = size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
      ]}
    >
      <AppText weight="700" style={{ color: palette.primaryFg, fontSize: size * 0.4 }}>
        {initials(name)}
      </AppText>
    </View>
  );
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const styles = StyleSheet.create({
  base: { backgroundColor: palette.neutral200 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
