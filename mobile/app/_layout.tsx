import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/src/services/auth';
import { NotificationProvider } from '@/src/contexts/NotificationContext';
import { usePushNotifications } from '@/src/hooks/usePushNotifications';

export const unstable_settings = {
  anchor: 'welcome',
};

function GoogleAuthHandler() {
  const { loginWithGoogle } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('id_token')) return;

    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get('id_token');
    if (!idToken) return;

    window.history.replaceState({}, '', window.location.pathname);

    loginWithGoogle(idToken)
      .then(() => setDone(true))
      .catch((err) => {
        console.error('[Igualo] Google login failed:', err);
      });
  }, []);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  usePushNotifications();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <GoogleAuthHandler />
        <NotificationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </NotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
