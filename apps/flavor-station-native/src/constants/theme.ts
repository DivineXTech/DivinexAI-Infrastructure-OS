import { Platform } from 'react-native';

/**
 * Ported from the web app's src/index.css / tailwind.config.ts design tokens
 * (flavorful-foodie-forge). Brand is single-theme (dark), so light and dark
 * resolve to the same palette rather than an unbranded system default.
 */
const flavorStation = {
  background: '#050505',
  foreground: '#fafafa',
  card: '#0d0d0d',
  cardForeground: '#fafafa',
  primary: '#f97316',
  primaryForeground: '#000000',
  secondary: '#121212',
  secondaryForeground: '#fafafa',
  muted: '#3f3f46',
  mutedForeground: '#a1a1aa',
  accent: '#facc14',
  accentForeground: '#000000',
  destructive: '#ef4444',
  destructiveForeground: '#fafafa',
  border: 'rgba(255, 255, 255, 0.1)',
  ring: '#f97316',
} as const;

export const Colors = {
  light: flavorStation,
  dark: flavorStation,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Web glow/gradient values ported for native shadow use (iOS shadow*, Android elevation).
export const Glow = {
  primary: {
    shadowColor: '#f97316',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const;

export const Fonts = Platform.select({
  ios: { display: 'Bebas Neue', sans: 'system-ui', mono: 'ui-monospace' },
  android: { display: 'Bebas Neue', sans: 'normal', mono: 'monospace' },
  default: { display: 'Bebas Neue', sans: 'normal', mono: 'monospace' },
});

export const Radius = {
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
