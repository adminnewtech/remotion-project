/**
 * @elite/config/tailwind-preset
 *
 * Shared Tailwind CSS preset for Elite v1 (Newtech super-app).
 * Premium tech palette, Arabic-first (RTL) typography, consistent radii & shadows.
 *
 * Consume in a web app's tailwind.config.js:
 *
 *   const elitePreset = require('@elite/config/tailwind-preset');
 *   module.exports = { presets: [elitePreset], content: [...] };
 *
 * The raw token values are kept in sync with `@elite/ui` -> `tokens.ts`
 * (the platform-agnostic source consumed by the mobile app).
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
          // Elite OS spec primary indigo.
          DEFAULT: '#4f46e5',
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

        // ── Elite OS — "Light Pro" semantic tokens ──────────────────────
        // Backed by CSS variables (see web globals.css) so a `.dark` toggle
        // re-themes everything without changing class names. Use as
        // bg-eos-panel, text-eos-text, border-eos-border, etc.
        eos: {
          bg: 'var(--eos-bg)',
          panel: 'var(--eos-panel)',
          'panel-muted': 'var(--eos-panel-muted)',
          border: 'var(--eos-border)',
          text: 'var(--eos-text)',
          muted: 'var(--eos-muted)',
          primary: 'var(--eos-primary)',
          'primary-hover': 'var(--eos-primary-hover)',
          'primary-soft': 'var(--eos-primary-soft)',
          'primary-text': 'var(--eos-primary-text)',
          accent: 'var(--eos-accent)',
          success: 'var(--eos-success)',
          'success-bg': 'var(--eos-success-bg)',
          info: 'var(--eos-info)',
          'info-bg': 'var(--eos-info-bg)',
          warning: 'var(--eos-warning)',
          'warning-bg': 'var(--eos-warning-bg)',
          danger: 'var(--eos-danger)',
          'danger-bg': 'var(--eos-danger-bg)',
          neutral: 'var(--eos-neutral)',
          'neutral-bg': 'var(--eos-neutral-bg)',
          // Admin sidebar rail (fixed dark navy in both themes).
          sidebar: 'var(--eos-sidebar)',
          'sidebar-text': 'var(--eos-sidebar-text)',
          'sidebar-muted': 'var(--eos-sidebar-muted)',
        },

        // ── OSALPHA — "Gold" design system (live admin) ─────────────────
        // Backed by CSS variables (web globals.css) so `[data-theme="dark"]`
        // re-themes everything. Brand is GOLD; `aqua` is the workshop accent.
        // Use as bg-osa-surface, text-osa-ink, border-osa-border, etc.
        osa: {
          canvas: 'var(--osa-canvas)',
          surface: 'var(--osa-surface)',
          'surface-2': 'var(--osa-surface-2)',
          border: 'var(--osa-border)',
          'border-strong': 'var(--osa-border-strong)',
          ink: 'var(--osa-ink)',
          muted: 'var(--osa-muted)',
          faint: 'var(--osa-faint)',
          brand: 'var(--osa-brand)',
          'brand-strong': 'var(--osa-brand-strong)',
          'brand-dim': 'var(--osa-brand-dim)',
          'brand-border': 'var(--osa-brand-border)',
          aqua: 'var(--osa-aqua)',
          'aqua-dim': 'var(--osa-aqua-dim)',
          amber: 'var(--osa-amber)',
          'amber-dim': 'var(--osa-amber-dim)',
          green: 'var(--osa-green)',
          'green-dim': 'var(--osa-green-dim)',
          blue: 'var(--osa-blue)',
          'blue-dim': 'var(--osa-blue-dim)',
          rose: 'var(--osa-rose)',
          'rose-dim': 'var(--osa-rose-dim)',
        },
      },
      fontFamily: {
        // Arabic-first: Cairo/Tajawal lead, then Latin fallbacks.
        sans: ['Cairo', 'Tajawal', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        none: '0px',
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        // Elite OS control radius (inputs/buttons/chips) = 10px.
        control: '0.625rem',
        lg: '0.75rem',
        // Elite OS card radius = 12px.
        card: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
        // OSALPHA radii (gold admin): card 16px, control 10px.
        osa: '16px',
        'osa-sm': '10px',
      },
      spacing: {
        // Extends the default 4px scale with named app spacings.
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        sm: '0 1px 3px 0 rgb(15 23 42 / 0.10), 0 1px 2px -1px rgb(15 23 42 / 0.10)',
        md: '0 4px 6px -1px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.10)',
        lg: '0 10px 15px -3px rgb(15 23 42 / 0.10), 0 4px 6px -4px rgb(15 23 42 / 0.10)',
        xl: '0 20px 25px -5px rgb(15 23 42 / 0.10), 0 8px 10px -6px rgb(15 23 42 / 0.10)',
        focus: '0 0 0 3px rgb(79 70 229 / 0.30)',
        // ── Elite OS soft elevation (Light Pro) ──
        eos: '0 1px 2px rgba(16, 24, 40, 0.06)',
        'eos-hover': '0 4px 16px -4px rgba(16, 24, 40, 0.12)',
        'eos-popover': '0 8px 24px -8px rgba(16, 24, 40, 0.18)',
        // OSALPHA gold-admin soft elevation (CSS-var driven so dark = none).
        osa: 'var(--osa-shadow)',
      },
    },
  },
  // RTL-friendly: rely on logical properties (ms-*/me-*/ps-*/pe-*/start/end)
  // which Tailwind ships natively; no extra plugin required.
  plugins: [],
};

module.exports = preset;
