import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type PillVariant = 'muted' | 'primarySoft';

export type PillProps = ViewProps & {
  label: string;
  variant?: PillVariant;
};

const theme = Colors.dark;

// Ported from the web app's small rounded-full status/tag chips, e.g.
// "Coming Soon" items (muted) and "Online Pay Coming Soon" (primarySoft).
export function Pill({ label, variant = 'muted', style, ...rest }: PillProps) {
  return (
    <View style={[styles.base, variant === 'muted' ? styles.muted : styles.primarySoft, style]} {...rest}>
      <ThemedText
        type="smallBold"
        themeColor={variant === 'muted' ? 'mutedForeground' : 'primary'}
        style={styles.label}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  muted: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.foregroundSoft,
  },
  primarySoft: {
    backgroundColor: theme.primarySoft,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 10 * 0.1,
  },
});
