import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

const theme = Colors.dark;

// Ported from the web app's recurring input classes, e.g. CheckoutForm's
// "rounded-xl border border-border bg-background px-4 py-3 text-foreground".
export function Input({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.mutedForeground}
      style={[styles.base, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: theme.foreground,
    fontSize: 16,
  },
});
