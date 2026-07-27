import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Glow, Radius, Spacing } from '@/constants/theme';

export type CardSize = 'default' | 'lg';

export type CardProps = ViewProps & {
  size?: CardSize;
  glow?: boolean;
};

const theme = Colors.dark;

// Ported from the web app's recurring card shell:
// "rounded-2xl border border-border bg-card p-4 shadow-depth" (and rounded-3xl/p-6
// variants for bigger cards, e.g. VipAccount).
export function Card({ size = 'default', glow = true, style, ...rest }: CardProps) {
  return (
    <View
      style={[styles.base, size === 'default' ? styles.default : styles.lg, glow && Glow.depth, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  default: {
    borderRadius: Radius.xl,
    padding: Spacing.three,
  },
  lg: {
    borderRadius: Radius.xxl,
    padding: Spacing.four,
  },
});
