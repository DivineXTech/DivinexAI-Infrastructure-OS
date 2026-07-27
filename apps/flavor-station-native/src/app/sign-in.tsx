import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScreenContainer } from '@/components/ui/screen-container';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: otpError } = await signInWithOtp(trimmed);
    setSubmitting(false);
    if (otpError) {
      setError(otpError);
      return;
    }
    router.push({ pathname: '/verify', params: { email: trimmed } });
  };

  return (
    <ScreenContainer style={{ justifyContent: 'center' }}>
      <ThemedText type="eyebrow">Account</ThemedText>
      <ThemedText type="title">Sign In</ThemedText>
      <ThemedText type="default" themeColor="mutedForeground">
        We&apos;ll email you a one-time code — no password needed.
      </ThemedText>

      <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          onSubmitEditing={handleSubmit}
        />
        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
        <Button
          label={submitting ? 'Sending code…' : 'Send code'}
          onPress={handleSubmit}
          disabled={submitting}
        />
      </View>
    </ScreenContainer>
  );
}
