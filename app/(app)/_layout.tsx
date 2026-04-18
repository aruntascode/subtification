import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Stack } from "expo-router";
import { useEffect } from "react";

export default function AppLayout() {
  const fetchSubscriptions = useSubscriptionStore((s) => s.fetchSubscriptions);
  const { colors } = useAppTheme();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  return (
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
  );
}
