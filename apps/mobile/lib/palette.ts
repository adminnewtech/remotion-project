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

type SpaceTokens = { xs?: number; sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number };
const sp = (tokens?.spacing ?? {}) as SpaceTokens;

/** Spacing scale (px). Falls back to a 4px-based scale. */
export const space = {
  xs: sp.xs ?? 4,
  sm: sp.sm ?? 8,
  md: sp.md ?? 16,
  lg: sp.lg ?? 24,
  xl: sp.xl ?? 32,
  '2xl': sp['2xl'] ?? 48,
} as const;

type RadiiTokens = { sm?: number; md?: number; lg?: number; xl?: number; '2xl'?: number; full?: number };
const rd = (tokens?.radii ?? {}) as RadiiTokens;

/** Border radii (px). */
export const radii = {
  sm: rd.sm ?? 6,
  md: rd.md ?? 10,
  lg: rd.lg ?? 14,
  xl: rd.xl ?? 18,
  '2xl': rd['2xl'] ?? 26,
  full: rd.full ?? 9999,
} as const;

type FontSizeTokens = {
  xs?: number; sm?: number; base?: number; lg?: number; xl?: number;
  '2xl'?: number; '3xl'?: number; '4xl'?: number;
};
const fs = (tokens?.fontSizes ?? {}) as FontSizeTokens;

/** Font sizes (px). */
export const fontSizes = {
  xs: fs.xs ?? 12,
  sm: fs.sm ?? 14,
  base: fs.base ?? 16,
  lg: fs.lg ?? 18,
  xl: fs.xl ?? 20,
  '2xl': fs['2xl'] ?? 24,
  '3xl': fs['3xl'] ?? 30,
  '4xl': fs['4xl'] ?? 36,
} as const;

type FontFamilyTokens = { sans?: string; arabic?: string; latin?: string };
const ff = (tokens?.fontFamilies ?? {}) as FontFamilyTokens;

/** Font families. RN takes a single family name string per platform font. */
export const fonts = {
  sans: ff.sans ?? 'System',
  arabic: ff.arabic ?? ff.sans ?? 'System',
  latin: ff.latin ?? ff.sans ?? 'System',
} as const;
