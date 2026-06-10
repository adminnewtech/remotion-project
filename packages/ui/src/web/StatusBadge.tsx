import * as React from 'react';

import type { OrderStatus, TaskStatus } from '@elite/types';

import { orderStatusMeta, taskStatusMeta, type StatusDescriptor } from '../status';
import { Badge, type BadgeProps } from './Badge';

type StatusBadgeBase = Omit<BadgeProps, 'tone' | 'children'> & {
  /**
   * Optional translator. Given a labelKey it returns a display string.
   * Wire this to `(key) => t(key, locale)` from `@elite/i18n`. If omitted,
   * the raw labelKey is shown (handy in tests/storybook).
   */
  translate?: (labelKey: string) => string;
  /** Optional icon renderer mapping an icon name → node (e.g. lucide). */
  renderIcon?: (iconName: string) => React.ReactNode;
  /** Explicit, already-resolved display text. Wins over the derived labelKey. */
  label?: React.ReactNode;
  /** Alias for `label` — explicit display text that overrides the derived label. */
  labelOverride?: React.ReactNode;
};

/**
 * Flexible status props. Either pass a typed `order`/`task` status, or a raw
 * `status` string — tone/icon are derived from the shared status map and the
 * display text falls back to an explicit `label`/`labelOverride` when given.
 */
export type StatusBadgeProps = StatusBadgeBase & {
  order?: OrderStatus;
  task?: TaskStatus;
  status?: OrderStatus | TaskStatus | string;
};

/**
 * Renders a status chip for an OrderStatus or TaskStatus using the shared
 * `status.ts` descriptor (tone + labelKey + icon). Resilient to unknown
 * statuses and supports an explicit label override.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { translate, renderIcon, order, task, status, label, labelOverride, ...badgeProps } = props;

  // Resolve the descriptor from whichever status form was supplied.
  let meta: StatusDescriptor;
  if (task !== undefined) {
    meta = taskStatusMeta(task);
  } else if (order !== undefined) {
    meta = orderStatusMeta(order);
  } else {
    // Raw `status` string: try the order map first, then the task map.
    const fromOrder = orderStatusMeta(status);
    meta = fromOrder.labelKey === 'common.unknown' ? taskStatusMeta(status) : fromOrder;
  }

  const explicit = labelOverride ?? label;
  const text = explicit ?? (translate ? translate(meta.labelKey) : meta.labelKey);
  const icon = renderIcon ? renderIcon(meta.icon) : undefined;

  return (
    <Badge tone={meta.tone} icon={icon} {...badgeProps}>
      {text}
    </Badge>
  );
}
