import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      {/* SDK 58 removed StatusBar backgroundColor/translucent: only `style` is set. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ title: 'NEWS2 Triage' }} />
        <Stack.Screen name="result" options={{ title: 'Result' }} />
      </Stack>
    </>
  );
}
