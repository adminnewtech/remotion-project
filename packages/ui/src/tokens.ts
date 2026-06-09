/**
 * @elite/ui/tokens — platform-agnostic design tokens for Elite v1.
 *
 * These raw values are the single source of truth shared by:
 *  - the web Tailwind preset (`@elite/config/tailwind-preset`) — kept in sync, and
 *  - the mobile app (React Native), which imports THIS module directly
 *    (it cannot use Tailwind classes).
 *
 * No platform APIs are referenced here, so it is safe to import anywhere.
 */

export const colors = {
  // Premium deep indigo/blue primary scale.
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#4f46e5',
    600: '#4338ca',
    700: '#3730a3',
    800: '#312e81',
    900: '#1e1b4b',
    DEFAULT: '#4338ca',
    foreground: '#ffffff',
  },
  // Electric cyan accent.
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    DEFAULT: '#06b6d4',
    foreground: '#06283d',
  },
  // Neutral grays (slate-leaning).
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    DEFAULT: '#10b981',
    foreground: '#ffffff',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    DEFAULT: '#f59e0b',
    foreground: '#3a2606',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    DEFAULT: '#ef4444',
    foreground: '#ffffff',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    DEFAULT: '#3b82f6',
    foreground: '#ffffff',
  },
  // Semantic surface tokens.
  background: '#f8fafc',
  surface: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  ring: '#4338ca',
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
} as const;

export const radii = {
  none: '0px',
  sm: '0.25rem',
  DEFAULT: '0.5rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  full: '9999px',
} as const;

export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
} as const;

export const lineHeights = {
  xs: '1rem',
  sm: '1.25rem',
  base: '1.5rem',
  lg: '1.75rem',
  xl: '1.75rem',
  '2xl': '2rem',
  '3xl': '2.25rem',
  '4xl': '2.5rem',
} as const;

export const fontFamilies = {
  // Arabic-first: Cairo/Tajawal lead, then Latin fallbacks.
  sans: ['Cairo', 'Tajawal', 'Inter', 'system-ui', 'sans-serif'],
  arabic: ['Cairo', 'Tajawal', 'sans-serif'],
  latin: ['Inter', 'system-ui', 'sans-serif'],
} as const;

export const shadows = {
  xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
  sm: '0 1px 3px 0 rgb(15 23 42 / 0.10), 0 1px 2px -1px rgb(15 23 42 / 0.10)',
  md: '0 4px 6px -1px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.10)',
  lg: '0 10px 15px -3px rgb(15 23 42 / 0.10), 0 4px 6px -4px rgb(15 23 42 / 0.10)',
  xl: '0 20px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.10)',
  focus: '0 0 0 3px rgb(67 56 202 / 0.35)',
} as const;

/** Bundled tokens object for convenient single-import access. */
export const tokens = {
  colors,
  spacing,
  radii,
  fontSizes,
  lineHeights,
  fontFamilies,
  shadows,
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof colors;
