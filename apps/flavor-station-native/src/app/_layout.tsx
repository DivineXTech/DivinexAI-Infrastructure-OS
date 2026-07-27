import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BebasNeue_400Regular, useFonts } from '@expo-google-fonts/bebas-neue';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue: BebasNeue_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* Flavor Station brand is single-theme (dark); ThemeProvider is fixed rather
          than following system color scheme so the app never shows an unbranded light UI. */}
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
