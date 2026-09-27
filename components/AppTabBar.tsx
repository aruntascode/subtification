import type { AppColors } from "@/constants/colors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useGlobalSearchParams, useRouter, useSegments } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Animated,
  DeviceEventEmitter,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SHEET_HEIGHT = 400;
/** Solma geçişinin başladığı oran; bunun üstü dokunuşları arkadaki içeriğe geçirir */
const TAB_BAR_FADE_START = 0.3;
const SHEET_DISMISS_DISTANCE = 88;
const SHEET_DISMISS_VELOCITY = 900;
const SHEET_UPWARD_DRAG_LIMIT = 96;

const TAB_PRESS_EVENTS = {
  "(home)": "homeTabPress",
  subscriptions: "subscriptionsTabPress",
  analytics: "analyticsTabPress",
} as const;

const TABS = [
  {
    name: "(home)",
    route: "/(app)/(home)" as const,
    labelKey: "tabs.home",
    icon: "home",
    iconOutline: "home-outline",
    isAction: false,
  },
  {
    name: "subscriptions",
    route: "/(app)/subscriptions" as const,
    labelKey: "tabs.subscriptions",
    icon: "albums",
    iconOutline: "albums-outline",
    isAction: false,
  },
  {
    name: "analytics",
    route: "/(app)/analytics" as const,
    labelKey: "tabs.analytics",
    icon: "stats-chart",
    iconOutline: "stats-chart-outline",
    isAction: false,
  },
  {
    name: "add_action",
    route: null,
    labelKey: "tabs.add",
    icon: "add-circle",
    iconOutline: "add-circle-outline",
    isAction: true,
  },
] as const;

export function AppTabBar() {
  const router = useRouter();
  const { t } = useTranslation();
  const segments = useSegments();
  const { custom } = useGlobalSearchParams<{ custom?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { colors, darkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const menuItems = useMemo(
    () => [
      {
        icon: "apps" as const,
        iconColor: colors.primary,
        iconBg: colors.primary + "18",
        title: t("tabs.popular_title"),
        subtitle: t("tabs.popular_subtitle"),
        route: "/(app)/new",
      },
      {
        icon: "library-add" as const,
        iconColor: colors.tertiaryFixedDim,
        iconBg: colors.tertiaryFixedDim + "18",
        title: t("tabs.bulk_title"),
        subtitle: t("tabs.bulk_subtitle"),
        route: "/(app)/bulk-add",
      },
      {
        icon: "edit" as const,
        iconColor: colors.secondary,
        iconBg: colors.secondary + "18",
        title: t("tabs.custom_title"),
        subtitle: t("tabs.custom_subtitle"),
        route: "/(app)/new?custom=true",
      },
    ],
    [colors, t],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sheetY = useSharedValue(SHEET_HEIGHT);
  const gestureStartY = useSharedValue(0);
  const backdropProgress = useSharedValue(0);
  const pendingCloseCallback = useRef<(() => void) | undefined>(undefined);

  const finishCloseSheet = useCallback(() => {
    setSheetOpen(false);
    pendingCloseCallback.current?.();
    pendingCloseCallback.current = undefined;
  }, []);

  const resetRotateIcon = useCallback(() => {
    Animated.timing(rotateAnim, {
      toValue: 0,
      duration: 210,
      useNativeDriver: true,
    }).start();
  }, [rotateAnim]);

  const openSheet = () => {
    sheetY.value = SHEET_HEIGHT;
    gestureStartY.value = 0;
    backdropProgress.value = 0;
    setSheetOpen(true);
    requestAnimationFrame(() => {
      sheetY.value = withSpring(0, {
        damping: 24,
        stiffness: 260,
        mass: 0.9,
      });
      backdropProgress.value = withTiming(1, { duration: 250 });
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeSheet = (callback?: () => void) => {
    pendingCloseCallback.current = callback;
    backdropProgress.value = withTiming(0, { duration: 250 });
    sheetY.value = withTiming(SHEET_HEIGHT, { duration: 280 }, (finished) => {
      if (finished) {
        runOnJS(finishCloseSheet)();
      }
    });
    Animated.timing(rotateAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const sheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          gestureStartY.value = sheetY.value;
        })
        .onUpdate((event) => {
          const nextY = gestureStartY.value + event.translationY;
          sheetY.value =
            nextY < 0
              ? -Math.min(Math.abs(nextY) * 0.45, SHEET_UPWARD_DRAG_LIMIT)
              : nextY;
        })
        .onEnd((event) => {
          const shouldDismiss =
            sheetY.value > SHEET_DISMISS_DISTANCE ||
            event.velocityY > SHEET_DISMISS_VELOCITY;

          if (shouldDismiss) {
            backdropProgress.value = withTiming(0, { duration: 220 });
            sheetY.value = withTiming(SHEET_HEIGHT, { duration: 230 }, (finished) => {
              if (finished) {
                runOnJS(finishCloseSheet)();
              }
            });
            runOnJS(resetRotateIcon)();
            return;
          }

          sheetY.value = withSpring(0, {
            damping: 22,
            stiffness: 300,
            mass: 0.9,
            velocity: event.velocityY,
          });
        }),
    [backdropProgress, finishCloseSheet, gestureStartY, resetRotateIcon, sheetY],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  const handleMenuItem = (route: string) => {
    const currentSegments = segments as string[];
    const customParam = Array.isArray(custom) ? custom[0] : custom;
    const isNewScreen = currentSegments.includes("new");
    const targetIsNewScreen = route.startsWith("/(app)/new");
    const targetIsCustomMode = route.includes("custom=true");
    const currentIsCustomMode = customParam === "true";
    const targetMatchesCurrentMode = targetIsCustomMode === currentIsCustomMode;

    if (isNewScreen && targetIsNewScreen) {
      if (targetMatchesCurrentMode) {
        closeSheet();
        return;
      }

      closeSheet(() => router.replace(route as any));
      return;
    }

    closeSheet(() => router.push(route as any));
  };

  const iconRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  // Segments'e bakarak hangi tab'ın aktif olduğunu belirle
  const isTabActive = (tabName: string): boolean => {
    const currentSegments = segments as string[];
    const isHomeRoute =
      currentSegments.includes("(home)") ||
      (currentSegments[0] === "(app)" &&
        !currentSegments.some((segment) =>
          ["subscriptions", "analytics", "new", "settings", "subscription"].includes(segment),
        ));

    if (tabName === "(home)") return isHomeRoute;
    if (tabName === "subscriptions")
      return (
        currentSegments.includes("subscriptions") &&
        !currentSegments.includes("(home)")
      );
    if (tabName === "analytics")
      return currentSegments.includes("analytics");
    return false;
  };

  const handleTabPress = (tab: (typeof TABS)[number]) => {
    if (tab.isAction) {
      if (sheetOpen) {
        closeSheet();
      } else {
        openSheet();
      }
      return;
    }
    if (isTabActive(tab.name)) {
      DeviceEventEmitter.emit(TAB_PRESS_EVENTS[tab.name]);
      if (sheetOpen) closeSheet();
      return;
    }
    if (sheetOpen) closeSheet();
    if (tab.route) router.replace(tab.route);
  };

  return (
    <>
      {/* ── Bottom Sheet Modal ── */}
      <Modal
        visible={sheetOpen}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => closeSheet()}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          <Reanimated.View
            style={[styles.backdrop, backdropAnimatedStyle]}
            pointerEvents="box-none"
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
          </Reanimated.View>

          <GestureDetector gesture={sheetPanGesture}>
            <Reanimated.View
              style={[
                styles.sheet,
                { paddingBottom: 20 },
                sheetAnimatedStyle,
              ]}
            >
              <View style={styles.sheetHandleArea}>
                <View style={styles.sheetHandle} />
              </View>
              <Text style={styles.sheetTitle}>Abonelik Ekle</Text>
              {menuItems.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.menuItem}
                  activeOpacity={0.75}
                  onPress={() => handleMenuItem(item.route)}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                    <MaterialIcons name={item.icon} size={24} color={item.iconColor} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              ))}
            </Reanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBarWrapper, { bottom: 0 }]} pointerEvents="box-none">
        <LinearGradient
          colors={[
            colors.surface + "00",
            colors.surface + "80",
            colors.surface + "E6",
            colors.surface + "FD",
            colors.surface,
          ]}
          locations={[TAB_BAR_FADE_START, 0.45, 0.55, 0.65, 0.75]}
          style={styles.tabBarGradient}
          // Şeffaf üst kısım kör nokta olmasın: dokunuş alttaki listeye geçsin
          pointerEvents="box-none"
        >
          {/* Solmanın başladığı yerden aşağısı tamamen sekme çubuğuna ait */}
          <View style={[styles.tabContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {TABS.map((tab) => {
              const isFocused = !tab.isAction && isTabActive(tab.name);
              const color = tab.isAction
                ? sheetOpen
                  ? colors.primary
                  : colors.onSurfaceVariant
                : isFocused
                ? colors.primary
                : colors.onSurfaceVariant;

              return (
                <TouchableOpacity
                  key={tab.name}
                  onPress={() => handleTabPress(tab)}
                  style={styles.tabItemContainer}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabItem}>
                    {tab.isAction ? (
                      <Animated.View style={{ transform: [{ rotate: iconRotate }] }}>
                        <Ionicons name="add-circle" size={32} color={color} />
                      </Animated.View>
                    ) : (
                      <Ionicons
                        name={(isFocused ? tab.icon : tab.iconOutline) as any}
                        size={28}
                        color={color}
                      />
                    )}
                    <Text style={[styles.tabLabel, { color }]}>
                      {tab.isAction && sheetOpen ? t("tabs.close") : t(tab.labelKey)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      </View>
    </>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  // ── Tab Bar ──
  tabBarWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 130,
    zIndex: 100,
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
  },
  tabBarGradient: {
    flex: 1,
    justifyContent: "flex-end",
  },
  tabContent: {
    height: `${(1 - TAB_BAR_FADE_START) * 100}%`,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  // Sütunun tamamı dokunulabilir; simge ve yazı altta durur
  tabItemContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
    letterSpacing: 0.3,
  },

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: darkMode ? "rgba(0, 0, 0, 0.62)" : "rgba(25, 27, 34, 0.45)",
    zIndex: 200,
  },

  // ── Bottom Sheet ──
  sheet: {
    position: "absolute",
    bottom: 100,
    left: 12,
    right: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    zIndex: 300,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  sheetHandleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.onSurfaceVariant,
    textTransform: "uppercase",
    marginBottom: 16,
    marginLeft: 4,
  },

  // ── Menu Items ──
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  menuIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1 },
  menuTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.onSurfaceVariant,
    lineHeight: 18,
  },
});
