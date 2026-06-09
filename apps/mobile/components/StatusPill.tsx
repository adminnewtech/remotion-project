/**
 * StatusPill — compact colored badge for order/task/ticket statuses.
 * Accepts either a tone directly or an order/task status (auto-mapped).
 */
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { OrderStatus, TaskStatus } from '@elite/types';
import { radii, space, fontSizes } from '../lib/palette';
import {
  orderStatusKey,
  orderStatusTone,
  taskStatusKey,
  taskStatusTone,
  toneColors,
  type Tone,
} from '../lib/status';
import { useLocale } from '../lib/i18n';
import { AppText } from './Text';

interface BaseProps {
  style?: ViewStyle;
}
interface ToneProps extends BaseProps {
  tone: Tone;
  label: string;
}
interface OrderProps extends BaseProps {
  orderStatus: OrderStatus;
}
interface TaskProps extends BaseProps {
  taskStatus: TaskStatus;
}

type StatusPillProps = ToneProps | OrderProps | TaskProps;

export function StatusPill(props: StatusPillProps) {
  const { t } = useLocale();

  let tone: Tone;
  let label: string;

  if ('orderStatus' in props) {
    tone = orderStatusTone(props.orderStatus);
    label = t(orderStatusKey(props.orderStatus));
  } else if ('taskStatus' in props) {
    tone = taskStatusTone(props.taskStatus);
    label = t(taskStatusKey(props.taskStatus));
  } else {
    tone = props.tone;
    label = props.label;
  }

  const { fg, bg } = toneColors(tone);

  return (
    <View style={[styles.pill, { backgroundColor: bg }, props.style]}>
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <AppText weight="600" style={{ color: fg, fontSize: fontSizes.xs }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginEnd: 6 },
});
