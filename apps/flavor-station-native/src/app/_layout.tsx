import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BebasNeue_400Regular, useFonts } from '@expo-google-fonts/bebas-neue';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { loading: authLoading } = useAuth();
  const [fontsLoaded] = useFonts({
    BebasNeue: BebasNeue_400Regular,
  });

  const ready = fontsLoaded && !authLoading;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Flavor Station brand is single-theme (dark); ThemeProvider is fixed rather
            than following system color scheme so the app never shows an unbranded light UI. */}
        <ThemeProvider value={DarkTheme}>
          <RootNavigator />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
