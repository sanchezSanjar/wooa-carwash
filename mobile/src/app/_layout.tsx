import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { I18nProvider, useI18n } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { ready, user, updateProfile } = useAuth();
  const { ready: langReady, lang, t } = useI18n();
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? Colors.dark : Colors.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    if (ready && langReady) SplashScreen.hideAsync();
  }, [ready, langReady]);

  // notifications and SMS follow the language the member uses in the app
  useEffect(() => {
    if (user && langReady && user.language !== lang) updateProfile({ language: lang }).catch(() => undefined);
  }, [user, lang, langReady, updateProfile]);

  if (!ready || !langReady) return null;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.text,
          border: colors.border,
        },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('Wooa Carwash') }} />
        <Stack.Screen name="(auth)/login" options={{ title: t('Log in'), presentation: 'modal' }} />
        <Stack.Screen name="(auth)/register" options={{ title: t('Create account'), presentation: 'modal' }} />
        <Stack.Screen name="(auth)/forgot" options={{ title: t('Reset password'), presentation: 'modal' }} />
        <Stack.Screen name="car/[id]" options={{ title: t('Car') }} />
        <Stack.Screen name="plan/[carId]" options={{ title: t('Wash plan') }} />
        <Stack.Screen name="wash/[subscriptionId]/[date]" options={{ title: t('Wash') }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </I18nProvider>
  );
}
