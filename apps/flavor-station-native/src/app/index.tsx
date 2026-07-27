import { Link } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/screen-container';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  return (
    <ScreenContainer style={{ justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText type="eyebrow">Food for the Soul</ThemedText>
      <ThemedText type="title" style={{ textAlign: 'center' }}>
        THE FLAVOR STATION
      </ThemedText>
      <ThemedText type="default" themeColor="mutedForeground">
        Scaffold checkpoint — Supabase client: {supabase ? 'initialized' : 'missing'}
      </ThemedText>
      <Link href="/style-guide">
        <ThemedText type="linkPrimary">View design system →</ThemedText>
      </Link>
    </ScreenContainer>
  );
}
