import "@/locales/i18n";
import "react-native-reanimated";
import { AppTabBar } from "@/components/AppTabBar";
import { SubtificationSplash } from "@/components/SubtificationSplash";
import { useAppTheme } from "@/hooks/useAppTheme";
import { configureNotificationHandler } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useThemeStore } from "@/stores/themeStore";
import * as SystemUI from "expo-system-ui";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const { session, initialized, initialize } = useAuthStore();
  const subscriptionsInitialized = useSubscriptionStore((s) => s.initialized);
  const { initializeTheme } = useThemeStore();
  const { colors, darkMode } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const [showInitialSplash, setShowInitialSplash] = useState(() => !initialized);

  const handleInitialSplashExit = useCallback(() => {
    setShowInitialSplash(false);
  }, []);

  useEffect(() => {
    configureNotificationHandler();
    initialize();
    initializeTheme();
  }, [initialize, initializeTheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.surface).catch(() => {});
  }, [colors.surface]);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (session && inAuthGroup) {
      router.replace("/(app)/(home)");
    }
  }, [session, initialized, segments, router]);

  useEffect(() => {
    if (!initialized) {
      setShowInitialSplash(true);
    }
  }, [initialized]);

  if (!initialized && showInitialSplash) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: colors.surface }}
      >
        <SubtificationSplash />
        <StatusBar style={darkMode ? "light" : "dark"} />
      </GestureHandlerRootView>
    );
  }

  const showTabBar =
    segments[0] === "(app)" && subscriptionsInitialized;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      {initialized && (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="(auth)"
            options={{ presentation: "modal", gestureEnabled: true }}
          />
        </Stack>
      )}
      <StatusBar style={darkMode ? "light" : "dark"} />
      {showTabBar && <AppTabBar />}
      {showInitialSplash && (
        <SubtificationSplash
          exiting={initialized}
          onExitComplete={handleInitialSplashExit}
          style={styles.splashOverlay}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
});
