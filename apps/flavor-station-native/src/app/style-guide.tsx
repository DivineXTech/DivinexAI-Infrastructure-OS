import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { ScreenContainer } from '@/components/ui/screen-container';
import { Spacing } from '@/constants/theme';

// Dev-only reference screen for the RestaurantOS design-token system — not
// linked from app navigation yet (no nav shell exists until a later
// milestone). Swap the token values in constants/theme.ts for a future
// client's brand and this screen becomes the fastest way to sanity-check it.
export default function StyleGuideScreen() {
  return (
    <ScreenContainer scroll>
      <ThemedText type="eyebrow">Design System</ThemedText>
      <ThemedText type="title">Style Guide</ThemedText>

      <ThemedText type="subtitle" style={{ marginTop: Spacing.four }}>
        Typography
      </ThemedText>
      <ThemedText type="eyebrow">Eyebrow label</ThemedText>
      <ThemedText type="title">Title / Display</ThemedText>
      <ThemedText type="subtitle">Subtitle</ThemedText>
      <ThemedText type="default">Default body text for paragraphs and descriptions.</ThemedText>
      <ThemedText type="small" themeColor="mutedForeground">
        Small muted text for captions and secondary info.
      </ThemedText>

      <ThemedText type="subtitle" style={{ marginTop: Spacing.four }}>
        Buttons
      </ThemedText>
      <View style={{ gap: Spacing.two, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Button label="Primary" variant="primary" onPress={() => {}} />
        <Button label="Outline" variant="outline" onPress={() => {}} />
        <Button label="Ghost" variant="ghost" onPress={() => {}} />
        <Button label="Disabled" variant="primary" disabled onPress={() => {}} />
        <Button label="Small" variant="primary" size="sm" onPress={() => {}} />
      </View>

      <ThemedText type="subtitle" style={{ marginTop: Spacing.four }}>
        Cards
      </ThemedText>
      <Card>
        <ThemedText type="smallBold" themeColor="accent">
          Card title
        </ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          Default card — rounded-2xl, border, shadow-depth.
        </ThemedText>
      </Card>
      <Card size="lg">
        <ThemedText type="smallBold" themeColor="accent">
          Large card
        </ThemedText>
        <ThemedText type="small" themeColor="mutedForeground">
          rounded-3xl variant, used for account/billing-style panels.
        </ThemedText>
      </Card>

      <ThemedText type="subtitle" style={{ marginTop: Spacing.four }}>
        Pills
      </ThemedText>
      <View style={{ gap: Spacing.two, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Pill label="Coming Soon" variant="muted" />
        <Pill label="Online Pay Coming Soon" variant="primarySoft" />
      </View>

      <View style={{ height: Spacing.six }} />
    </ScreenContainer>
  );
}
