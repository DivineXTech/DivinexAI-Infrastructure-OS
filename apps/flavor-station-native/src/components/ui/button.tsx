import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Glow, Radius, Spacing } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
export type ButtonSize = 'default' | 'sm';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const theme = Colors.dark;

// Ported from the web app's recurring CTA classes, e.g.
// "rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-glow-primary".
export function Button({ label, variant = 'primary', size = 'default', disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'default' ? styles.sizeDefault : styles.sizeSm,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'primary' && !disabled && Glow.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      {...rest}
    >
      <ThemedText
        type={size === 'sm' ? 'smallBold' : 'default'}
        themeColor={variant === 'primary' ? 'primaryForeground' : 'foreground'}
        style={styles.label}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.xl,
  },
  sizeDefault: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sizeSm: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primary: {
    backgroundColor: theme.primary,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontWeight: '700',
  },
});
