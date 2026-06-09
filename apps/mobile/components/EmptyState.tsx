/**
 * EmptyState — friendly empty/zero-data placeholder with optional CTA.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, radii, space } from '../lib/palette';
import { AppText } from './Text';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = '📦', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <AppText style={styles.icon}>{icon}</AppText>
      </View>
      <AppText variant="subtitle" center weight="700">
        {title}
      </AppText>
      {message ? (
        <AppText tone="muted" center style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <AppButton title={actionLabel} onPress={onAction} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radii.full,
    backgroundColor: palette.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  icon: { fontSize: 40 },
  message: { marginTop: space.sm, maxWidth: 280 },
  action: { marginTop: space.lg },
});
