import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScreenContainer } from '@/components/ui/screen-container';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, signInWithOtp } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    if (!email) {
      setError('Missing email — go back and start again.');
      return;
    }
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: verifyError } = await verifyOtp(email, code.trim());
    setSubmitting(false);
    if (verifyError) {
      setError(verifyError);
      return;
    }
    router.replace('/account');
  };

  const handleResend = async () => {
    if (!email) return;
    setResent(false);
    await signInWithOtp(email);
    setResent(true);
  };

  return (
    <ScreenContainer style={{ justifyContent: 'center' }}>
      <ThemedText type="eyebrow">Account</ThemedText>
      <ThemedText type="title">Enter Code</ThemedText>
      <ThemedText type="default" themeColor="mutedForeground">
        {email ? `We sent a 6-digit code to ${email}.` : 'Missing email — go back and start again.'}
      </ThemedText>

      <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
        <Input
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          onSubmitEditing={handleVerify}
        />
        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
        {resent ? (
          <ThemedText type="small" themeColor="accent">
            New code sent.
          </ThemedText>
        ) : null}
        <Button label={submitting ? 'Verifying…' : 'Verify'} onPress={handleVerify} disabled={submitting} />
        <Button label="Resend code" variant="ghost" size="sm" onPress={handleResend} disabled={submitting} />
      </View>
    </ScreenContainer>
  );
}
