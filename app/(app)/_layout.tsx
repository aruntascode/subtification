import { SubtificationSplash } from "@/components/SubtificationSplash";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAuthStore } from "@/stores/authStore";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export default function AppLayout() {
  const fetchSubscriptions = useSubscriptionStore((s) => s.fetchSubscriptions);
  const subscriptionsInitialized = useSubscriptionStore((s) => s.initialized);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { colors } = useAppTheme();
  const [showSplash, setShowSplash] = useState(
    () => !subscriptionsInitialized,
  );

  const handleSplashExit = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    void fetchSubscriptions().catch((error) => {
      console.warn("Abonelikler yüklenemedi.", error);
    });
  }, [fetchSubscriptions, userId]);

  useEffect(() => {
    if (!subscriptionsInitialized) {
      setShowSplash(true);
    }
  }, [subscriptionsInitialized]);

  if (!subscriptionsInitialized && showSplash) {
    return <SubtificationSplash />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="(home)" options={{ animation: "none" }} />
        <Stack.Screen name="subscriptions" options={{ animation: "none" }} />
        <Stack.Screen name="analytics" options={{ animation: "none" }} />
        <Stack.Screen
          name="new"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
      </Stack>
      {showSplash && (
        <SubtificationSplash
          exiting={subscriptionsInitialized}
          onExitComplete={handleSplashExit}
          style={styles.splashOverlay}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    elevation: 20,
  },
});
