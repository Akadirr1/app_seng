import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnnouncementsProvider } from '../src/announcements';
import { ContentProvider } from '../src/content';
import { FIREBASE_SETUP_HINT, isFirebaseConfigured } from '../src/firebaseConfig';
import { NotificationSync } from '../src/notifications';
import { QueryProvider } from '../src/gundem/providers/QueryProvider';
import { AuthProvider } from '../src/authStore';
import { AppStoreProvider } from '../src/store';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden — nothing to do.
});

// `.env` is gitignored, so a fresh clone or an EAS build without environment
// variables is the likeliest way Firebase breaks. Say so at startup rather than
// letting it surface as a throw from somewhere deep in a screen.
if (__DEV__ && !isFirebaseConfigured) {
  console.warn(`[firebase] ${FIREBASE_SETUP_HINT}`);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    PressStart2P_400Regular,
  });

  const onReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A font failure should not black-hole the app; fall through to system fonts.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider onLayout={onReady}>
      {/* Oturum en dışta: kayıt ekranı da, hesap ekranı da, katılma kapısı da
          aynı kullanıcıyı görmek zorunda. */}
      <AuthProvider>
        <AppStoreProvider>
        <ContentProvider>
          <AnnouncementsProvider>
            {/* AI Gündem'in sunucu durumu. Kulüp tarafı buna dokunmuyor; burada
                duruyor çünkü hem sekme hem makale rotası aynı önbelleği
                paylaşıyor ve kalıcı önbellek açılışta bir kez geri yükleniyor. */}
            <StatusBar style="light" />
            {/* Inside both providers: it needs events, registrations and prefs
                together to keep the reminder schedule current. Renders nothing. */}
            <NotificationSync />
            <QueryProvider>
              <RootStack />
            </QueryProvider>
          </AnnouncementsProvider>
        </ContentProvider>
        </AppStoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="etkinlik/[id]" />
        <Stack.Screen name="kayit/[id]" />
        <Stack.Screen name="giris" />
        <Stack.Screen name="kayit-ol" />
        <Stack.Screen name="dogrula" />
        <Stack.Screen name="qr" />
        <Stack.Screen name="hesap-sil" />
        <Stack.Screen name="bildirim-ayarlari" />
        <Stack.Screen name="duyuru/[id]" />
        <Stack.Screen name="cekilis/[id]" />
        <Stack.Screen name="cekilis-kurallari" />
        <Stack.Screen name="gundem/[id]" />
        <Stack.Screen name="gundem/ara" />
        <Stack.Screen
          name="kayit-basarili"
          // The confirmation is a terminal state — swiping back into the form
          // after submitting would be nonsense.
          options={{ animation: 'fade', gestureEnabled: false }}
        />
      </Stack>
    </View>
  );
}
