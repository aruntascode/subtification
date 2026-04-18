import "@/locales/i18n";
import "react-native-reanimated";
import { AppTabBar } from "@/components/AppTabBar";
import { useAppTheme } from "@/hooks/useAppTheme";
import { configureNotificationHandler } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import * as SystemUI from "expo-system-ui";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const { session, initialized, initialize } = useAuthStore();
  const { initializeTheme } = useThemeStore();
  const { colors, darkMode } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();

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

  const showTabBar = session && segments[0] === "(app)";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="(auth)"
          options={{ presentation: "modal", gestureEnabled: true }}
        />
      </Stack>
      <StatusBar style={darkMode ? "light" : "dark"} />
      {showTabBar && <AppTabBar />}
    </GestureHandlerRootView>
  );
}
