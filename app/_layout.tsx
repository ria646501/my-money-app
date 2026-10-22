import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ensurePortfolioDemoSeed } from '@/lib/demo-seed';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isDemoSeedReady, setIsDemoSeedReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    void ensurePortfolioDemoSeed()
      .catch((error) => {
        console.error('포트폴리오 데모 데이터를 준비하지 못했습니다.', error);
      })
      .finally(() => {
        if (isActive) {
          setIsDemoSeedReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (!isDemoSeedReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
