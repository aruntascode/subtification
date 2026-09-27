import "@/locales/i18n";
import "react-native-reanimated";
import { AppTabBar } from "@/components/AppTabBar";
import { KeyboardDoneBar } from "@/components/KeyboardDoneBar";
import { SubtificationSplash } from "@/components/SubtificationSplash";
import { useAppTheme } from "@/hooks/useAppTheme";
import { configureNotificationHandler } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useBudgetStore } from "@/stores/budgetStore";
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
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const initializeBudget = useBudgetStore((s) => s.initializeBudget);
  const budgetHydrated = useBudgetStore((s) => s.hydrated);
  // Kayıtlı tema ve bütçe okunmadan ekranları çizme; yoksa renk/bütçe sıçraması olur
  const ready = initialized && themeHydrated && budgetHydrated;
  const { colors, darkMode } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const [showInitialSplash, setShowInitialSplash] = useState(() => !ready);

  const handleInitialSplashExit = useCallback(() => {
    setShowInitialSplash(false);
  }, []);

  useEffect(() => {
    configureNotificationHandler();
    initialize();
    initializeTheme();
    initializeBudget();
  }, [initialize, initializeTheme, initializeBudget]);

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
    if (!ready) {
      setShowInitialSplash(true);
    }
  }, [ready]);

  if (!ready && showInitialSplash) {
    return (
      <GestureHandlerRootView
        style={{ flex: 1, backgroundColor: colors.surface }}
      >
        <SubtificationSplash />
        <StatusBar style={darkMode ? "light" : "dark"} />
      </GestureHandlerRootView>
    );
  }

  // Toplu ekleme kendi alt butonunu kullanıyor; sekme çubuğu onu örtmesin
  const showTabBar =
    segments[0] === "(app)" &&
    (segments as string[])[1] !== "bulk-add" &&
    subscriptionsInitialized;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      {ready && (
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
      {/* Sayı klavyesi ve not alanları için klavye üstü "Bitti" çubuğu */}
      <KeyboardDoneBar />
      {showInitialSplash && (
        <SubtificationSplash
          exiting={ready}
          onExitComplete={handleInitialSplashExit}
          style={styles.splashOverlay}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    elevation: 20,
  },
});
