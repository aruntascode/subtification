import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useAuthStore } from "@/stores/authStore";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function AppLayout() {
  const fetchSubscriptions = useSubscriptionStore((s) => s.fetchSubscriptions);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  // Çevrimdışı açılışta kullanıcı kayıtlı oturumdan gelir, session null kalır.
  // Bağlantı gelip token yenilenince session dolar; liste sunucudan tazelensin.
  const hasSession = useAuthStore((s) => s.session !== null);
  const { colors } = useAppTheme();
  useEffect(() => {
    void fetchSubscriptions().catch((error) => {
      console.warn("Abonelikler yüklenemedi.", error);
    });
  }, [fetchSubscriptions, userId, hasSession]);

  // Açılış splash'i kök layout'ta; abonelikler yüklenene kadar ekranı o örter
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
          name="bulk-add"
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
        <Stack.Screen
          name="subscription/edit/[id]"
          options={{ animation: "slide_from_right", gestureEnabled: true }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
