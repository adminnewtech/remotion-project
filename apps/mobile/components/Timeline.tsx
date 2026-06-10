/**
 * Timeline — vertical milestone tracker for order status and field-task
 * lifecycle. Highlights steps up to (and including) the active one.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { palette, space } from '../lib/palette';
import { AppText } from './Text';

export interface TimelineStep {
  key: string;
  label: string;
  /** Optional timestamp / detail line. */
  detail?: string;
}

interface TimelineProps {
  steps: TimelineStep[];
  /** Index of the current/active step; steps <= this are "done". */
  activeIndex: number;
}

export function Timeline({ steps, activeIndex }: TimelineProps) {
  return (
    <View>
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const reached = done || active;
        const last = i === steps.length - 1;
        const dotColor = active ? palette.primary : done ? palette.success : palette.neutral300;
        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.gutter}>
              <View style={[styles.dot, { backgroundColor: dotColor }]}>
                {done ? <View style={styles.check} /> : null}
              </View>
              {!last ? (
                <View
                  style={[styles.line, { backgroundColor: done ? palette.success : palette.neutral200 }]}
                />
              ) : null}
            </View>
            <View style={styles.body}>
              <AppText weight={reached ? '700' : '500'} tone={reached ? 'default' : 'muted'}>
                {step.label}
              </AppText>
              {step.detail ? (
                <AppText variant="caption" tone="muted" style={styles.detail}>
                  {step.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  gutter: { alignItems: 'center', width: 28 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  check: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  line: { width: 2, flex: 1, marginVertical: 2, minHeight: 24 },
  body: { flex: 1, paddingBottom: space.lg, marginStart: space.sm },
  detail: { marginTop: 2 },
});
