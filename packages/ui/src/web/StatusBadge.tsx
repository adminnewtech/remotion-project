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
};

export type StatusBadgeProps =
  | (StatusBadgeBase & { order: OrderStatus; task?: never })
  | (StatusBadgeBase & { task: TaskStatus; order?: never });

/**
 * Renders a status chip for an OrderStatus or TaskStatus using the shared
 * `status.ts` descriptor (tone + labelKey + icon).
 */
export function StatusBadge(props: StatusBadgeProps) {
  const { translate, renderIcon, order, task, ...badgeProps } = props as StatusBadgeBase & {
    order?: OrderStatus;
    task?: TaskStatus;
  };

  const meta: StatusDescriptor =
    order !== undefined ? orderStatusMeta(order) : taskStatusMeta(task as TaskStatus);

  const label = translate ? translate(meta.labelKey) : meta.labelKey;
  const icon = renderIcon ? renderIcon(meta.icon) : undefined;

  return (
    <Badge tone={meta.tone} icon={icon} {...badgeProps}>
      {label}
    </Badge>
  );
}
