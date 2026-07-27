import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScreenContainer } from '@/components/ui/screen-container';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

// Smoke-test surface for the auth flow milestone — proves sign-in, session
// persistence, and sign-out work end to end. The real Account screen (VIP
// membership, order history) is a later milestone; this just confirms
// there's a logged-in user to build that on top of.
export default function AccountScreen() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <ScreenContainer style={{ justifyContent: 'center' }}>
        <ThemedText type="eyebrow">Account</ThemedText>
        <ThemedText type="title">Not signed in</ThemedText>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ justifyContent: 'center' }}>
      <ThemedText type="eyebrow">Account</ThemedText>
      <ThemedText type="title">Signed In</ThemedText>
      <Card style={{ marginTop: Spacing.three }}>
        <ThemedText type="small" themeColor="mutedForeground">
          Email
        </ThemedText>
        <ThemedText type="default">{user.email}</ThemedText>
      </Card>
      <View style={{ marginTop: Spacing.three }}>
        <Button label="Sign out" variant="outline" onPress={() => signOut()} />
      </View>
    </ScreenContainer>
  );
}
