/**
 * Palette adapter — normalizes the shared `@elite/ui` tokens into the flat,
 * RN-friendly shape the mobile components consume.
 *
 * The `@elite/ui` token object mirrors `@elite/config/tailwind-preset` and has
 * the shape `{ colors, spacing, radii, fontSizes, fontFamilies }`. Color scales
 * are objects (`{ 50..950, DEFAULT, foreground }`); semantic colors are plain
 * strings. This module resolves either form to concrete hex strings so screens
 * never have to know whether a token is a scale or a string, and so the app
 * stays resilient if a particular sub-key is absent.
 */
import { tokens } from './theme';

type AnyColor = string | Record<string, string> | undefined;

/** Resolve a color token to a hex string, accepting a scale or a string. */
function color(value: AnyColor, shade = 'DEFAULT', fallback = '#000000'): string {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[shade] ?? value['500'] ?? value['DEFAULT'] ?? fallback;
}

const c = (tokens?.colors ?? {}) as Record<string, AnyColor>;

/**
 * Flat, semantic color palette used across mobile components. Mirrors the
 * premium indigo/cyan theme defined in the shared preset.
 */
export const palette = {
  // Brand
  primary: color(c.primary, 'DEFAULT', '#4338ca'),
  primaryDark: color(c.primary, '700', '#3730a3'),
  primaryLight: color(c.primary, '100', '#e0e7ff'),
  primaryFg: color(c.primary, 'foreground', '#ffffff'),

  accent: color(c.accent, 'DEFAULT', '#06b6d4'),
  accentLight: color(c.accent, '100', '#cffafe'),
  accentFg: color(c.accent, 'foreground', '#06283d'),

  // Status
  success: color(c.success, 'DEFAULT', '#10b981'),
  successBg: color(c.success, '100', '#d1fae5'),
  warning: color(c.warning, 'DEFAULT', '#f59e0b'),
  warningBg: color(c.warning, '100', '#fef3c7'),
  danger: color(c.danger, 'DEFAULT', '#ef4444'),
  dangerBg: color(c.danger, '100', '#fee2e2'),
  info: color(c.info, 'DEFAULT', '#3b82f6'),
  infoBg: color(c.info, '100', '#dbeafe'),

  // Neutrals / surfaces
  background: color(c.background, 'DEFAULT', '#f8fafc'),
  surface: color(c.surface, 'DEFAULT', '#ffffff'),
  foreground: color(c.foreground, 'DEFAULT', '#0f172a'),
  muted: color(c.muted, 'DEFAULT', '#64748b'),
  border: color(c.border, 'DEFAULT', '#e2e8f0'),

  neutral50: color(c.neutral, '50', '#f8fafc'),
  neutral100: color(c.neutral, '100', '#f1f5f9'),
  neutral200: color(c.neutral, '200', '#e2e8f0'),
  neutral300: color(c.neutral, '300', '#cbd5e1'),
  neutral400: color(c.neutral, '400', '#94a3b8'),
  neutral500: color(c.neutral, '500', '#64748b'),
  neutral700: color(c.neutral, '700', '#334155'),
  neutral900: color(c.neutral, '900', '#0f172a'),
} as const;

/**
 * Token sizing values come from the shared tokens as CSS `rem` strings (e.g.
 * `'1rem'`, `'0.75rem'`) so they can feed Tailwind on web. React Native needs
 * unitless numbers (px), so we convert rem→px at 16px/rem here, tolerating raw
 * numbers and `px` strings too.
 */
const REM_PX = 16;
function toPx(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const m = value.match(/^(-?\d*\.?\d+)(rem|px)?$/);
    if (m) {
      const n = parseFloat(m[1]!);
      return m[2] === 'px' ? n : m[2] === 'rem' || m[2] === undefined ? n * REM_PX : n;
    }
  }
  return fallback;
}

const sp = (tokens?.spacing ?? {}) as Record<string, unknown>;

/** Spacing scale (px). Falls back to a 4px-based scale. */
export const space = {
  xs: toPx(sp.xs, 4),
  sm: toPx(sp.sm, 8),
  md: toPx(sp.md, 16),
  lg: toPx(sp.lg, 24),
  xl: toPx(sp.xl, 32),
  '2xl': toPx(sp['2xl'], 48),
} as const;

const rd = (tokens?.radii ?? {}) as Record<string, unknown>;

/** Border radii (px). `full` stays a large pill value. */
export const radii = {
  sm: toPx(rd.sm, 4),
  md: toPx(rd.md, 8),
  lg: toPx(rd.lg, 12),
  xl: toPx(rd.xl, 16),
  '2xl': toPx(rd['2xl'], 24),
  full: typeof rd.full === 'number' ? (rd.full as number) : 9999,
} as const;

const fs = (tokens?.fontSizes ?? {}) as Record<string, unknown>;

/** Font sizes (px). */
export const fontSizes = {
  xs: toPx(fs.xs, 12),
  sm: toPx(fs.sm, 14),
  base: toPx(fs.base, 16),
  lg: toPx(fs.lg, 18),
  xl: toPx(fs.xl, 20),
  '2xl': toPx(fs['2xl'], 24),
  '3xl': toPx(fs['3xl'], 30),
  '4xl': toPx(fs['4xl'], 36),
} as const;

const ff = (tokens?.fontFamilies ?? {}) as Record<string, unknown>;

/**
 * Font families. The tokens store font stacks as arrays (CSS font-family
 * lists); RN takes a single family name, so we pick the first entry. These
 * names must match fonts actually loaded at runtime (e.g. via expo-font);
 * 'System' is a safe fallback before custom fonts are bundled.
 */
function firstFamily(value: unknown, fallback: string): string {
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (typeof value === 'string') return value;
  return fallback;
}

export const fonts = {
  sans: firstFamily(ff.sans, 'System'),
  arabic: firstFamily(ff.arabic, 'System'),
  latin: firstFamily(ff.latin, 'System'),
} as const;
