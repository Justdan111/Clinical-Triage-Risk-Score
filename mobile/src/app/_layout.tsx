import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemeProvider, typeStyle, useTheme } from '@/theme/theme';

// Keep the splash up until fonts have loaded (or failed), so text never
// flashes from the system font to Plus Jakarta Sans.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // A font failure must never block the app: fall back to the system font.
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider fontsLoaded={fontsLoaded}>
        <Navigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Navigator() {
  const { colors, scheme, fontsLoaded } = useTheme();
  const reduced = useReducedMotion();
  return (
    <>
      {/* SDK 58 removed StatusBar backgroundColor/translucent: only `style` is set. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          // Directional: forward slides in from the right, back slides out. Fade with Reduce Motion.
          animation: reduced ? 'fade' : 'slide_from_right',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { ...typeStyle('heading', fontsLoaded), color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'NEWS2 Triage' }} />
        {/* The result screen draws its own top bar so the band tint fills the whole screen. */}
        <Stack.Screen name="result" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
