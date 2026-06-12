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

/**
 * Elite OS — "Light Pro" semantic palette.
 *
 * The premium, Linear/Stripe-grade surface system applied to the admin shell
 * and global theme. These are the *semantic* tokens (canvas/panel/border/…)
 * that map 1:1 to the `--eos-*` CSS variables (see web `globals.css`) and the
 * Tailwind `colors.eos.*` tokens (see `@elite/config/tailwind-preset`).
 *
 * Default is light; a `.dark` variant (dark-navy panels) is exposed for a
 * future toggle. Components should prefer these `eos` tokens for new surfaces.
 */
export const eos = {
  /** App canvas behind panels. */
  bg: '#f6f7fb',
  /** Raised panel / card surface. */
  panel: '#ffffff',
  /** Subtle panel-2 (sticky table header, wells). */
  panelMuted: '#f1f3f9',
  /** Hairline border. */
  border: '#e8ebf2',
  /** Primary text. */
  text: '#0f172a',
  /** Secondary / muted text. */
  muted: '#64748b',

  /** Brand indigo. */
  primary: '#4f46e5',
  primaryHover: '#4338ca',
  /** Tinted indigo wash (active rows, soft fills). */
  primarySoft: '#eef2ff',
  primaryText: '#3730a3',
  /** Cyan accent. */
  accent: '#06b6d4',

  // Status — foreground + soft background pairs.
  success: '#059669',
  successBg: '#d1fae5',
  info: '#2563eb',
  infoBg: '#dbeafe',
  warning: '#d97706',
  warningBg: '#fef3c7',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  neutral: '#64748b',
  neutralBg: '#f1f5f9',

  /** Fixed dark-navy admin sidebar rail. */
  sidebar: '#0b1020',
  sidebarText: '#cbd5e1',
  sidebarMuted: '#64748b',
} as const;

/** Dark-navy variant of the `eos` semantic tokens (future `.dark` toggle). */
export const eosDark = {
  bg: '#0a0e17',
  panel: '#0f1626',
  panelMuted: '#131b2e',
  border: '#1f2a44',
  text: '#e8edf7',
  muted: '#94a3b8',

  primary: '#6366f1',
  primaryHover: '#818cf8',
  primarySoft: '#1e2440',
  primaryText: '#c7d2fe',
  accent: '#22d3ee',

  success: '#34d399',
  successBg: '#053a2b',
  info: '#60a5fa',
  infoBg: '#0b2545',
  warning: '#fbbf24',
  warningBg: '#3a2a06',
  danger: '#f87171',
  dangerBg: '#3a1212',
  neutral: '#94a3b8',
  neutralBg: '#1e293b',

  sidebar: '#070a12',
  sidebarText: '#cbd5e1',
  sidebarMuted: '#64748b',
} as const;

export type EosTokens = typeof eos;

/**
 * OSALPHA — "Gold" semantic palette (the live admin design system).
 *
 * Source of truth for the OSALPHA admin shell + overview. These map 1:1 to the
 * `--osa-*` CSS variables (web `globals.css`) and the Tailwind `colors.osa.*`
 * tokens (`@elite/config/tailwind-preset`). The brand is GOLD; the teal `aqua`
 * is the workshop accent; status colors (blue/green/amber/rose) follow the
 * reference mockup. A `[data-theme="dark"]` block re-themes everything.
 *
 * Light values below; the dark values live in `osalphaDark`.
 */
export const osalpha = {
  // Surfaces
  canvas: '#F6F6FB',
  surface: '#FFFFFF',
  surface2: '#F2F1F9',
  border: 'rgba(28,25,60,.08)',
  borderStrong: 'rgba(28,25,60,.16)',
  // Text
  ink: '#1C193C',
  muted: '#5D5A7D',
  faint: '#9C99B5',
  // Brand — GOLD
  brand: '#B8860B',
  brandStrong: '#946E12',
  brandDim: 'rgba(184,134,11,.12)',
  brandBorder: 'rgba(184,134,11,.30)',
  /** Gold gradient stops for the logo mark / featured fills. */
  brandGradientFrom: '#946E12',
  brandGradientTo: '#E2C66A',
  // Status — aqua is the workshop accent (teal).
  aqua: '#0E9F8C',
  aquaDim: 'rgba(14,159,140,.10)',
  amber: '#C2700A',
  amberDim: 'rgba(217,119,6,.12)',
  green: '#15803D',
  greenDim: 'rgba(21,128,61,.10)',
  blue: '#2563EB',
  blueDim: 'rgba(37,99,235,.08)',
  rose: '#E11D48',
  roseDim: 'rgba(225,29,72,.08)',
  // Elevation + radii
  shadow: '0 1px 3px rgba(28,25,60,.06),0 4px 14px rgba(28,25,60,.05)',
  radius: '16px',
  radiusSm: '10px',
  radiusFull: '99px',
} as const;

/** Dark variant of the OSALPHA gold tokens (`[data-theme="dark"]`). */
export const osalphaDark = {
  canvas: '#12101F',
  surface: '#1A1730',
  surface2: '#231F3D',
  border: 'rgba(167,160,210,.10)',
  borderStrong: 'rgba(167,160,210,.20)',
  ink: '#EDEBFA',
  muted: '#A7A0C8',
  faint: '#6F6A92',
  // Brand brightens in dark.
  brand: '#E3B341',
  brandStrong: '#C9A227',
  brandDim: 'rgba(227,179,65,.12)',
  brandBorder: 'rgba(227,179,65,.30)',
  brandGradientFrom: '#C9A227',
  brandGradientTo: '#E2C66A',
  aqua: '#2DD4BF',
  aquaDim: 'rgba(45,212,191,.10)',
  amber: '#FBBF24',
  amberDim: 'rgba(251,191,36,.10)',
  green: '#34D399',
  greenDim: 'rgba(52,211,153,.10)',
  blue: '#60A5FA',
  blueDim: 'rgba(96,165,250,.10)',
  rose: '#FB7185',
  roseDim: 'rgba(251,113,133,.10)',
  shadow: 'none',
  radius: '16px',
  radiusSm: '10px',
  radiusFull: '99px',
} as const;

export type OsalphaTokens = typeof osalpha;

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
  /** Elite OS control radius (inputs, buttons, chips). */
  control: '0.625rem', // 10px
  lg: '0.75rem',
  /** Elite OS card radius. */
  card: '0.75rem', // 12px
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
  '2xl': '0 25px 50px -12px rgb(15 23 42 / 0.25)',
  focus: '0 0 0 3px rgb(67 56 202 / 0.35)',
  // --- Semantic, role-based shadows (premium feel) ---
  card: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
  cardHover: '0 8px 20px -6px rgb(15 23 42 / 0.16)',
  dropdown: '0 8px 24px -8px rgb(15 23 42 / 0.20)',
  modal: '0 24px 48px -12px rgb(15 23 42 / 0.35)',
  /** Electric-cyan accent glow for primary/featured CTAs and highlights. */
  glow: '0 0 0 1px rgb(6 182 212 / 0.20), 0 8px 24px -6px rgb(6 182 212 / 0.45)',
  /** Inner shadow for inset fields/wells. */
  inner: 'inset 0 2px 4px 0 rgb(15 23 42 / 0.06)',
  // --- Elite OS soft elevation (Light Pro) ---
  /** EOS base hairline elevation for panels/cards. */
  eos: '0 1px 2px rgba(16, 24, 40, 0.06)',
  /** EOS hover lift for interactive cards. */
  eosHover: '0 4px 16px -4px rgba(16, 24, 40, 0.12)',
  /** EOS popover/dropdown elevation. */
  eosPopover: '0 8px 24px -8px rgba(16, 24, 40, 0.18)',
} as const;

/**
 * Z-index scale — semantic layering so overlays never fight each other.
 * Kept in sync with the web components (Modal uses 50, Toast uses 60).
 */
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 10,
  sticky: 20,
  header: 30,
  dropdown: 40,
  overlay: 50,
  modal: 50,
  drawer: 50,
  toast: 60,
  tooltip: 70,
} as const;

/** Bundled tokens object for convenient single-import access. */
export const tokens = {
  colors,
  eos,
  eosDark,
  osalpha,
  osalphaDark,
  spacing,
  radii,
  fontSizes,
  lineHeights,
  fontFamilies,
  shadows,
  zIndex,
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = typeof colors;
