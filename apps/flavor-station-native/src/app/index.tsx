import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="small" themeColor="accent" style={styles.eyebrow}>
          Food for the Soul
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          THE FLAVOR STATION
        </ThemedText>
        <ThemedText type="default" themeColor="mutedForeground">
          Scaffold checkpoint — Supabase client: {supabase ? 'initialized' : 'missing'}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'BebasNeue',
  },
});
