/**
 * Toggle — labelled switch row (used for "Buy + Install", availability
 * online/offline, set-as-default address, etc).
 */
import React from 'react';
import { StyleSheet, Switch, View, type ViewStyle } from 'react-native';
import { palette, space } from '../lib/palette';
import { AppText } from './Text';

interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Toggle({ label, description, value, onValueChange, disabled, style }: ToggleProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <AppText weight="600">{label}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted" style={styles.desc}>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: palette.neutral300, true: palette.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { flex: 1, marginEnd: space.md },
  desc: { marginTop: 2 },
});
