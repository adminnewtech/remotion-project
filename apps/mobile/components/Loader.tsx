/**
 * Loader — centered spinner with an optional caption, plus an inline variant.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { palette, space } from '../lib/palette';
import { AppText } from './Text';

interface LoaderProps {
  label?: string;
  inline?: boolean;
  color?: string;
}

export function Loader({ label, inline = false, color = palette.primary }: LoaderProps) {
  if (inline) {
    return <ActivityIndicator color={color} />;
  }
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={color} />
      {label ? (
        <AppText tone="muted" style={styles.label}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  label: { marginTop: space.md },
});
