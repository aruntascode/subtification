import "@/locales/i18n";
import "react-native-reanimated";
import { AppTabBar } from "@/components/AppTabBar";
import { KeyboardDoneBar } from "@/components/KeyboardDoneBar";
import { SubtificationSplash } from "@/components/SubtificationSplash";
import { useAppTheme } from "@/hooks/useAppTheme";
import { configureNotificationHandler } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useBudgetStore } from "@/stores/budgetStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useThemeStore } from "@/stores/themeStore";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Native splash, JS splash ilk karesini çizene kadar kalır (SubtificationSplash kapatır)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { session, initialized, initialize } = useAuthStore();
  const subscriptionsInitialized = useSubscriptionStore((s) => s.initialized);
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const initializeBudget = useBudgetStore((s) => s.initializeBudget);
  const budgetHydrated = useBudgetStore((s) => s.hydrated);
  const initializeOnboarding = useOnboardingStore((s) => s.initializeOnboarding);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const onboardingCompleted = useOnboardingStore((s) => s.completed);
  // Kayıtlı tema, bütçe ve onboarding okunmadan ekranları çizme; yoksa sıçrama olur
  const ready = initialized && themeHydrated && budgetHydrated && onboardingHydrated;
  const { colors, darkMode } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const inOnboarding = (segments[0] as string) === "onboarding";
  // Splash, ilk gösterilecek ekran hazır olana kadar kalır: onboarding'e
  // yönlendirildiyse orası, değilse aboneliklerin yüklendiği ana sayfa
  const contentReady =
    ready && (onboardingCompleted ? subscriptionsInitialized : inOnboarding);
  // Tek bir splash örneği her açılışta bir kez gösterilir; kaybolunca geri gelmez
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashExit = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    configureNotificationHandler();
    initialize();
    initializeTheme();
    initializeBudget();
    initializeOnboarding();
  }, [initialize, initializeTheme, initializeBudget, initializeOnboarding]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.surface).catch(() => {});
  }, [colors.surface]);

  useEffect(() => {
    if (!ready) return;

    if (!onboardingCompleted) {
      if (!inOnboarding) router.replace("/onboarding" as never);
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    if (session && inAuthGroup) {
      router.replace("/(app)/(home)");
    }
  }, [ready, onboardingCompleted, inOnboarding, session, segments, router]);

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
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
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
      {showSplash && (
        <SubtificationSplash
          exiting={contentReady}
          onExitComplete={handleSplashExit}
          style={styles.splashOverlay}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Sekme çubuğu (zIndex 100–300) dahil her şeyin üstünde
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
  },
});
