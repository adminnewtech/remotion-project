/**
 * Screen — the standard page container. Applies safe-area insets, the app
 * background, and (optionally) a scroll view. Direction-aware via the locale
 * hook so RTL content lays out correctly.
 */
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { palette, space } from '../lib/palette';
import { useLocale } from '../lib/i18n';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Background color override (e.g. dark field-app screens). */
  background?: string;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  refreshing,
  onRefresh,
  edges = ['top', 'left', 'right'],
  style,
  contentStyle,
  background = palette.background,
}: ScreenProps) {
  const { dir } = useLocale();
  const writingDirection = dir; // 'rtl' | 'ltr'

  const inner: ViewStyle = {
    flexGrow: 1,
    padding: padded ? space.md : 0,
    writingDirection,
  } as ViewStyle;

  if (scroll) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: background }, style]} edges={edges}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[inner, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={palette.primary}
                colors={[palette.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }, style]} edges={edges}>
      <View style={[inner, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
