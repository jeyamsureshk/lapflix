import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="editor" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="photo-viewer" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="player" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="upload" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
