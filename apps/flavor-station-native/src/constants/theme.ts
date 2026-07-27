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
  // Soft tint fills ported from web's bg-primary/15, bg-foreground/[0.04] etc.
  primarySoft: 'rgba(249, 115, 22, 0.15)',
  foregroundSoft: 'rgba(255, 255, 255, 0.04)',
} as const;

export const Colors = {
  light: flavorStation,
  dark: flavorStation,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Web's --glow-primary / --border-glow box-shadows, ported for native shadow use
// (iOS shadow*, Android elevation). RN can't stack multiple box-shadow layers
// the way CSS can, so --border-glow's 3-layer shadow collapses to one.
export const Glow = {
  primary: {
    shadowColor: '#f97316',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  depth: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

// 'BebasNeue' must match the key registered via useFonts() in _layout.tsx —
// RN resolves custom fonts by that registration key, not the font's real name,
// and that key is the same across platforms (no Platform.select needed here).
export const Fonts = {
  display: 'BebasNeue',
  ...Platform.select({
    ios: { sans: 'system-ui', mono: 'ui-monospace' },
    android: { sans: 'normal', mono: 'monospace' },
    default: { sans: 'normal', mono: 'monospace' },
  }),
};

// Matches tailwind.config.ts's overridden radii (lg = --radius = 1rem, not the
// Tailwind default), not Tailwind's stock rounded-* scale.
export const Radius = {
  md: 12, // rounded-md: calc(var(--radius) - 4px)
  lg: 16, // rounded-lg: var(--radius)
  xl: 24, // rounded-2xl (web overrides this to 1.5rem)
  xxl: 32, // rounded-3xl (web overrides this to 2rem)
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

// Web's common px-5 screen gutter (20px) doesn't land on the Spacing scale above.
export const ScreenPadding = 20;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
