/**
 * Theme bridge — re-exports the shared @elite/ui design tokens (the only thing
 * we import from @elite/ui on mobile; never @elite/ui/web) plus a few RN-only
 * helpers derived from them (shadow presets, hit slop, etc).
 *
 * Tokens shape (from @elite/ui): { colors, spacing, radii, fontSizes, fontFamilies }.
 */
import { tokens, formatKWD, formatDate } from '@elite/ui';
import { Platform } from 'react-native';

export { tokens, formatKWD, formatDate };

export type Tokens = typeof tokens;

/** Elevation/shadow presets that read tokens for color. */
export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }) as object,
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 6 },
    default: {},
  }) as object,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
