import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ScreenPadding, Spacing } from '@/constants/theme';

export type ScreenContainerProps = (ViewProps | ScrollViewProps) & {
  scroll?: boolean;
};

// Standard screen shell: themed background + safe area + horizontal gutter,
// matching the web app's recurring "mx-auto max-w-7xl px-5" section wrapper.
export function ScreenContainer({ scroll = false, style, children, ...rest }: ScreenContainerProps) {
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, style]} {...rest}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, style]} {...rest}>
            {children}
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: ScreenPadding,
    gap: Spacing.three,
  },
});
