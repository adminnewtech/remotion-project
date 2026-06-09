import type { Config } from 'tailwindcss';
// Shared brand preset (palette, radii, shadows, RTL) from the config package.
import elitePreset from '@elite/config/tailwind-preset';

const config: Config = {
  presets: [elitePreset as Partial<Config>],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    // Pull class names out of the shared UI package too.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // App-local fallbacks; the preset is the source of truth for the brand.
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
