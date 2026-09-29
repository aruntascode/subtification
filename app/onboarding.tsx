import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  ensureNotificationPermission,
  setPushAlertsEnabled,
  syncSubscriptionNotifications,
} from "@/lib/notifications";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PageKind = "feature" | "notifications" | "auth";

type Page = {
  kind: PageKind;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const NOTIFICATIONS_PAGE = 3;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Küçük ekranlarda (iPhone SE) yazılar ve butonlar sığsın diye görsel küçülür
  const art = Math.min(260, Math.round(height * 0.3));
  const { colors, darkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const pages: Page[] = [
    { kind: "feature", icon: "albums", title: t("onboarding.f1_title"), body: t("onboarding.f1_body") },
    { kind: "feature", icon: "pie-chart", title: t("onboarding.f2_title"), body: t("onboarding.f2_body") },
    { kind: "feature", icon: "calendar", title: t("onboarding.f3_title"), body: t("onboarding.f3_body") },
    { kind: "notifications", icon: "notifications", title: t("onboarding.notif_title"), body: t("onboarding.notif_body") },
    { kind: "auth", icon: "cloud-done", title: t("onboarding.auth_title"), body: t("onboarding.auth_body") },
  ];
  const page = pages[index];

  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(next, pages.length - 1));
    scrollRef.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const handleAllowNotifications = async () => {
    setRequestingPermission(true);
    try {
      const granted = await ensureNotificationPermission();
      await setPushAlertsEnabled(granted);
      if (granted) {
        await syncSubscriptionNotifications(useSubscriptionStore.getState().subscriptions);
      }
    } catch {
      // İzin alınamazsa akış durmasın; ayarlardan sonra açılabilir
    } finally {
      setRequestingPermission(false);
      goTo(index + 1);
    }
  };

  const finish = async (next: "register" | "login" | null) => {
    await completeOnboarding();
    router.replace("/(app)/(home)");
    if (next === "register") router.push("/(auth)/register");
    if (next === "login") router.push("/(auth)/login");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View style={styles.logoCard}>
          <Text style={styles.logoText}>Sub.</Text>
        </View>
        {page.kind === "feature" && (
          <TouchableOpacity
            onPress={() => goTo(NOTIFICATIONS_PAGE)}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
      >
        {pages.map((item) => (
          <View key={item.title} style={[styles.page, { width }]}>
            <View style={[styles.illustration, { width: art, height: art }]}>
              <View style={[styles.ring, styles.ringOuter, circle(art)]} />
              <View style={[styles.ring, styles.ringInner, circle(art * 0.77)]} />
              <LinearGradient
                colors={[colors.heroGradientStart, colors.heroGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.iconTile, { width: art * 0.52, height: art * 0.52 }]}
              >
                <Ionicons name={item.icon} size={Math.round(art * 0.25)} color="#ffffff" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityRole="adjustable">
        {pages.map((item, i) => (
          <View key={item.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {page.kind === "feature" && (
          <PrimaryButton label={t("onboarding.next")} onPress={() => goTo(index + 1)} styles={styles} colors={colors} />
        )}

        {page.kind === "notifications" && (
          <>
            <PrimaryButton
              label={t("onboarding.notif_allow")}
              onPress={handleAllowNotifications}
              loading={requestingPermission}
              styles={styles}
              colors={colors}
            />
            <TouchableOpacity
              style={styles.textButton}
              onPress={() => goTo(index + 1)}
              disabled={requestingPermission}
            >
              <Text style={styles.textButtonText}>{t("onboarding.notif_later")}</Text>
            </TouchableOpacity>
          </>
        )}

        {page.kind === "auth" && (
          <>
            <PrimaryButton
              label={t("onboarding.auth_register")}
              onPress={() => finish("register")}
              styles={styles}
              colors={colors}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={() => finish("login")}>
              <Text style={styles.secondaryButtonText}>{t("onboarding.auth_login")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={() => finish(null)}>
              <Text style={styles.textButtonText}>{t("onboarding.auth_guest")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const circle = (size: number) => ({ width: size, height: size, borderRadius: size / 2 });

function PrimaryButton({
  label,
  onPress,
  loading = false,
  styles,
  colors,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.9}>
      <LinearGradient
        colors={[colors.primarySolid, colors.primarySolidContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryButton}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>{label}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xxl,
      paddingTop: Spacing.md,
      minHeight: 56,
    },
    logoCard: {
      paddingHorizontal: 8,
      height: 30,
      justifyContent: "center",
      borderRadius: 6,
      backgroundColor: colors.primarySolid,
    },
    logoText: {
      // Logo: splash kartıyla aynı (Inter Black, kırık beyaz)
      color: colors.logoText,
      fontFamily: "Inter",
      fontSize: 18,
      fontWeight: "900",
    },
    skipText: {
      ...Typography.labelLg,
      color: colors.onSurfaceVariant,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.huge,
    },
    illustration: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.huge,
    },
    ring: {
      position: "absolute",
    },
    ringOuter: {
      backgroundColor: colors.primary + (darkMode ? "12" : "0D"),
    },
    ringInner: {
      backgroundColor: colors.primary + (darkMode ? "1F" : "17"),
    },
    iconTile: {
      borderRadius: BorderRadius.xxxl,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOpacity: darkMode ? 0.3 : 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    title: {
      ...Typography.headlineLg,
      color: colors.onSurface,
      textAlign: "center",
      marginBottom: Spacing.md,
    },
    body: {
      ...Typography.bodyLg,
      color: colors.onSurfaceVariant,
      textAlign: "center",
    },
    dots: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      marginVertical: Spacing.xl,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.onSurfaceVariant + "40",
    },
    dotActive: {
      width: 20,
      backgroundColor: colors.primary,
    },
    actions: {
      paddingHorizontal: Spacing.xxl,
      paddingBottom: Spacing.lg,
      minHeight: 164,
      justifyContent: "flex-start",
      gap: Spacing.sm,
    },
    primaryButton: {
      borderRadius: BorderRadius.xl,
      paddingVertical: 16,
      alignItems: "center",
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    primaryButtonText: {
      ...Typography.labelLg,
      color: colors.onPrimary,
      fontWeight: "700",
    },
    secondaryButton: {
      borderRadius: BorderRadius.xl,
      paddingVertical: 16,
      alignItems: "center",
      backgroundColor: colors.surfaceContainerLow,
    },
    secondaryButtonText: {
      ...Typography.labelLg,
      color: colors.primary,
      fontWeight: "700",
    },
    textButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    textButtonText: {
      ...Typography.labelLg,
      color: colors.onSurfaceVariant,
    },
  });
