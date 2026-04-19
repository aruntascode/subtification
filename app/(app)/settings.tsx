import type { AppColors } from "@/constants/colors";
import { getCurrencyBySymbol } from "@/constants/currencies";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  cancelSubscriptionNotifications,
  ensureNotificationPermission,
  getPushAlertsEnabled,
  setPushAlertsEnabled,
  syncSubscriptionNotifications,
} from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { useThemeStore } from "@/stores/themeStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTabBar } from "@/components/AppTabBar";

const SELECTABLE_CURRENCY_SYMBOLS = ["₺", "$", "€", "£", "¥"] as const;
const CURRENCY_SHEET_CLOSED_Y = 520;
const CURRENCY_SHEET_DISMISS_DISTANCE = 110;
const CURRENCY_SHEET_DISMISS_VELOCITY = 900;
const CURRENCY_SHEET_UPWARD_DRAG_LIMIT = 90;
const CURRENCY_SHEET_BOTTOM_FILL_HEIGHT = 140;

type PickerOption = {
  key: string;
  glyph: string;
  title: string;
  selected: boolean;
  onPress: () => void;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuthStore();
  const subscriptions = useSubscriptionStore((state) => state.subscriptions);
  const { displayCurrency, setDisplayCurrency, ratesError } = useCurrencyStore();

  const [pushAlerts, setPushAlerts] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // YENİ: Dil Modalı için State
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const { darkMode, setDarkMode } = useThemeStore();
  const { colors, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const currencySheetColors = useMemo(
    () => ({
      backdrop: darkMode ? "rgba(0, 0, 0, 0.34)" : "rgba(25, 27, 34, 0.20)",
      sheet: darkMode ? "#19191f" : "#fbf9ff",
      divider: darkMode ? "#302f38" : "#e2e0eb",
      handle: darkMode ? "#6d6a75" : "#b8b4c3",
      card: darkMode ? "#272631" : "#ffffff",
      cardBorder: darkMode ? "#343240" : "#e1deeb",
      headerPanel: darkMode ? "#202029" : "#ffffff",
      headerPanelBorder: darkMode ? "#343240" : "#e7e4f0",
      selectedRow: darkMode ? "#25242e" : "#eef3ff",
      rowBorder: darkMode ? "rgba(255, 255, 255, 0.04)" : "rgba(25, 27, 34, 0.05)",
      iconBg: darkMode ? "#101116" : "#f0edf8",
      selectedIconBg: darkMode ? "#d8fddf" : "#d9e2ff",
      title: darkMode ? "#f8f5ff" : colors.onSurface,
      rowText: darkMode ? "#f8f5ff" : colors.onSurface,
      iconText: darkMode ? "#ded9e6" : colors.onSurfaceVariant,
      selectedIconText: darkMode ? "#0f1411" : colors.primary,
      checkBg: darkMode ? "#69ff87" : colors.primaryFixed,
      checkColor: darkMode ? "#0f1411" : colors.primary,
      accent: darkMode ? "#69ff87" : colors.primary,
      selectedBorder: darkMode ? "rgba(105, 255, 135, 0.34)" : "rgba(0, 46, 115, 0.22)",
      sectionLabel: darkMode ? "#8f8a99" : colors.outline,
    }),
    [colors, darkMode],
  );
  const currencySheetY = useSharedValue(CURRENCY_SHEET_CLOSED_Y);
  const currencyGestureStartY = useSharedValue(0);
  const currencyBackdropProgress = useSharedValue(0);
  const languageSheetY = useSharedValue(CURRENCY_SHEET_CLOSED_Y);
  const languageGestureStartY = useSharedValue(0);
  const languageBackdropProgress = useSharedValue(0);
  const passwordSheetY = useSharedValue(CURRENCY_SHEET_CLOSED_Y);
  const passwordGestureStartY = useSharedValue(0);
  const passwordBackdropProgress = useSharedValue(0);

  useEffect(() => {
    getPushAlertsEnabled().then(setPushAlerts);
  }, [user]);

  const finishCurrencyDismiss = useCallback(() => {
    setCurrencyModalVisible(false);
  }, []);

  const finishLanguageDismiss = useCallback(() => {
    setLanguageModalVisible(false);
  }, []);

  const finishPasswordDismiss = useCallback(() => {
    setChangePasswordVisible(false);
  }, []);

  const openCurrencyModal = () => {
    currencySheetY.value = CURRENCY_SHEET_CLOSED_Y;
    currencyGestureStartY.value = 0;
    currencyBackdropProgress.value = 0;
    setCurrencyModalVisible(true);
    requestAnimationFrame(() => {
      currencySheetY.value = withSpring(0, {
        damping: 26,
        stiffness: 280,
        mass: 0.9,
      });
      currencyBackdropProgress.value = withTiming(1, { duration: 180 });
    });
  };

  const closeCurrencyModal = () => {
    currencyBackdropProgress.value = withTiming(0, { duration: 160 });
    currencySheetY.value = withTiming(
      CURRENCY_SHEET_CLOSED_Y,
      { duration: 190 },
      (finished) => {
        if (finished) {
          runOnJS(finishCurrencyDismiss)();
        }
      },
    );
  };

  const currencyPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          currencyGestureStartY.value = currencySheetY.value;
        })
        .onUpdate((event) => {
          const nextY = currencyGestureStartY.value + event.translationY;
          currencySheetY.value =
            nextY < 0
              ? -Math.min(Math.abs(nextY) * 0.32, CURRENCY_SHEET_UPWARD_DRAG_LIMIT)
              : nextY;
        })
        .onEnd((event) => {
          const shouldDismiss =
            currencySheetY.value > CURRENCY_SHEET_DISMISS_DISTANCE ||
            event.velocityY > CURRENCY_SHEET_DISMISS_VELOCITY;

          if (shouldDismiss) {
            currencyBackdropProgress.value = withTiming(0, { duration: 160 });
            currencySheetY.value = withTiming(
              CURRENCY_SHEET_CLOSED_Y,
              { duration: 190 },
              (finished) => {
                if (finished) {
                  runOnJS(finishCurrencyDismiss)();
                }
              },
            );
          } else {
            currencySheetY.value = withSpring(0, {
              damping: 24,
              stiffness: 300,
              mass: 0.9,
              velocity: event.velocityY,
            });
          }
        }),
    [currencyBackdropProgress, currencyGestureStartY, currencySheetY, finishCurrencyDismiss],
  );

  const currencySheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: currencySheetY.value }],
  }));

  const currencyBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: currencyBackdropProgress.value,
  }));

  const openLanguageModal = () => {
    languageSheetY.value = CURRENCY_SHEET_CLOSED_Y;
    languageGestureStartY.value = 0;
    languageBackdropProgress.value = 0;
    setLanguageModalVisible(true);
    requestAnimationFrame(() => {
      languageSheetY.value = withSpring(0, {
        damping: 26,
        stiffness: 280,
        mass: 0.9,
      });
      languageBackdropProgress.value = withTiming(1, { duration: 180 });
    });
  };

  const closeLanguageModal = () => {
    languageBackdropProgress.value = withTiming(0, { duration: 160 });
    languageSheetY.value = withTiming(
      CURRENCY_SHEET_CLOSED_Y,
      { duration: 190 },
      (finished) => {
        if (finished) {
          runOnJS(finishLanguageDismiss)();
        }
      },
    );
  };

  const languagePanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          languageGestureStartY.value = languageSheetY.value;
        })
        .onUpdate((event) => {
          const nextY = languageGestureStartY.value + event.translationY;
          languageSheetY.value =
            nextY < 0
              ? -Math.min(Math.abs(nextY) * 0.32, CURRENCY_SHEET_UPWARD_DRAG_LIMIT)
              : nextY;
        })
        .onEnd((event) => {
          const shouldDismiss =
            languageSheetY.value > CURRENCY_SHEET_DISMISS_DISTANCE ||
            event.velocityY > CURRENCY_SHEET_DISMISS_VELOCITY;

          if (shouldDismiss) {
            languageBackdropProgress.value = withTiming(0, { duration: 160 });
            languageSheetY.value = withTiming(
              CURRENCY_SHEET_CLOSED_Y,
              { duration: 190 },
              (finished) => {
                if (finished) {
                  runOnJS(finishLanguageDismiss)();
                }
              },
            );
          } else {
            languageSheetY.value = withSpring(0, {
              damping: 24,
              stiffness: 300,
              mass: 0.9,
              velocity: event.velocityY,
            });
          }
        }),
    [finishLanguageDismiss, languageBackdropProgress, languageGestureStartY, languageSheetY],
  );

  const languageSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: languageSheetY.value }],
  }));

  const languageBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: languageBackdropProgress.value,
  }));

  const openChangePasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    passwordSheetY.value = CURRENCY_SHEET_CLOSED_Y;
    passwordGestureStartY.value = 0;
    passwordBackdropProgress.value = 0;
    setChangePasswordVisible(true);
    requestAnimationFrame(() => {
      passwordSheetY.value = withSpring(0, {
        damping: 26,
        stiffness: 280,
        mass: 0.9,
      });
      passwordBackdropProgress.value = withTiming(1, { duration: 180 });
    });
  };

  const closeChangePasswordModal = () => {
    passwordBackdropProgress.value = withTiming(0, { duration: 160 });
    passwordSheetY.value = withTiming(
      CURRENCY_SHEET_CLOSED_Y,
      { duration: 190 },
      (finished) => {
        if (finished) {
          runOnJS(finishPasswordDismiss)();
        }
      },
    );
  };

  const passwordPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          passwordGestureStartY.value = passwordSheetY.value;
        })
        .onUpdate((event) => {
          const nextY = passwordGestureStartY.value + event.translationY;
          passwordSheetY.value =
            nextY < 0
              ? -Math.min(Math.abs(nextY) * 0.32, CURRENCY_SHEET_UPWARD_DRAG_LIMIT)
              : nextY;
        })
        .onEnd((event) => {
          const shouldDismiss =
            passwordSheetY.value > CURRENCY_SHEET_DISMISS_DISTANCE ||
            event.velocityY > CURRENCY_SHEET_DISMISS_VELOCITY;

          if (shouldDismiss) {
            passwordBackdropProgress.value = withTiming(0, { duration: 160 });
            passwordSheetY.value = withTiming(
              CURRENCY_SHEET_CLOSED_Y,
              { duration: 190 },
              (finished) => {
                if (finished) {
                  runOnJS(finishPasswordDismiss)();
                }
              },
            );
          } else {
            passwordSheetY.value = withSpring(0, {
              damping: 24,
              stiffness: 300,
              mass: 0.9,
              velocity: event.velocityY,
            });
          }
        }),
    [finishPasswordDismiss, passwordBackdropProgress, passwordGestureStartY, passwordSheetY],
  );

  const passwordSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: passwordSheetY.value }],
  }));

  const passwordBackdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: passwordBackdropProgress.value,
  }));

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      Alert.alert(t("common.error"), t("settings.change_password_fill_all"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("common.error"), t("settings.change_password_mismatch"));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t("common.error"), t("settings.change_password_too_short"));
      return;
    }
    if (!user?.email) return;

    setPasswordLoading(true);
    try {
      // Re-authenticate to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        Alert.alert(t("common.error"), t("settings.change_password_wrong_current"));
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      closeChangePasswordModal();
      setTimeout(() => Alert.alert("✓", t("settings.change_password_success")), 350);
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const currentCurrency = getCurrencyBySymbol(displayCurrency);
  const isTurkish = i18n.language.startsWith("tr");

  const handleSelectCurrency = async (symbol: string) => {
    await setDisplayCurrency(symbol);
    closeCurrencyModal();
  };

  const handleSelectLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    closeLanguageModal();
  };

  const currencyCopyByIso: Record<string, string> = isTurkish
    ? {
        TRY: "Türk Lirası",
        USD: "ABD Doları",
        EUR: "Euro",
        GBP: "İngiliz Sterlini",
        JPY: "Japon Yeni",
      }
    : {
        TRY: "Turkish Lira",
        USD: "US Dollar",
        EUR: "Euro",
        GBP: "British Pound",
        JPY: "Japanese Yen",
      };

  const currencyOptions: PickerOption[] = SELECTABLE_CURRENCY_SYMBOLS.map((symbol) => {
    const currency = getCurrencyBySymbol(symbol);
    const title = currencyCopyByIso[currency.iso] ?? currency.name;

    return {
      key: currency.iso,
      glyph: currency.symbol,
      title,
      selected: displayCurrency === currency.symbol,
      onPress: () => handleSelectCurrency(currency.symbol),
    };
  });

  const languageOptions: PickerOption[] = [
    {
      key: "tr",
      glyph: "TR",
      title: "Türkçe",
      selected: isTurkish,
      onPress: () => handleSelectLanguage("tr"),
    },
    {
      key: "en",
      glyph: "EN",
      title: "English",
      selected: !isTurkish,
      onPress: () => handleSelectLanguage("en"),
    },
  ];

  const handlePushAlertsChange = async (enabled: boolean) => {
    try {
      if (!enabled) {
        setPushAlerts(false);
        await setPushAlertsEnabled(false);
        await cancelSubscriptionNotifications();
        return;
      }

      const granted = await ensureNotificationPermission();
      if (!granted) {
        setPushAlerts(false);
        await setPushAlertsEnabled(false);
        Alert.alert(
          t("settings.notifications_permission_title"),
          t("settings.notifications_permission_message"),
        );
        return;
      }

      setPushAlerts(true);
      await setPushAlertsEnabled(true);
      await syncSubscriptionNotifications(subscriptions);
    } catch {
      setPushAlerts(false);
      await setPushAlertsEnabled(false);
      Alert.alert(
        t("settings.notifications_permission_title"),
        t("settings.notifications_permission_message"),
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t("settings.sign_out_confirm_title"),
      t("settings.sign_out_confirm_message"),
      [
        { text: t("settings.sign_out_cancel"), style: "cancel" },
        {
          text: t("settings.sign_out_confirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Frosted Glass Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.headerOverlay,
            darkMode && { backgroundColor: "rgba(16, 18, 22, 0.05)" },
          ]}
        />
        <View
          style={[
            styles.headerBorder,
            darkMode && { backgroundColor: "rgba(242, 244, 251, 0.08)" },
          ]}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
            {t("settings.title")}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 64 }]}
      >

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.profile_section")}
          </Text>
          <TouchableOpacity
            style={[styles.profileCard, { backgroundColor: colors.surfaceContainerLow }]}
            activeOpacity={0.8}
            onPress={() => {
              if (user) {
                handleSignOut();
              } else {
                router.push("/(auth)/login");
              }
            }}
          >
            <View style={styles.profileRow}>
              <View
                style={[
                  styles.profileAvatar,
                  { backgroundColor: darkMode ? "#22314f" : colors.primaryFixed },
                ]}
              >
                <Ionicons name="person" size={28} color={darkMode ? "#b9ceff" : colors.primary} />
                <View
                  style={[
                    styles.profileEditBadge,
                    user && { backgroundColor: colors.error },
                  ]}
                >
                  <Ionicons
                    name={user ? "log-out-outline" : "log-in-outline"}
                    size={10}
                    color="#fff"
                  />
                </View>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.onSurface }]}>
                  {user?.email?.split("@")[0] ?? t("settings.guest")}
                </Text>
                <Text style={[styles.profileEmail, { color: colors.onSurfaceVariant }]}>
                  {user?.email ?? t("settings.tap_to_sign_in")}
                </Text>
              </View>
              <View
                style={[
                  styles.profileAction,
                  user ? styles.profileActionDanger : styles.profileActionPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.profileActionText,
                    user ? styles.profileActionTextDanger : styles.profileActionTextPrimary,
                  ]}
                >
                  {user ? t("settings.sign_out") : t("settings.sign_in_register")}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.preferences_section")}
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surfaceContainerLow }]}>
            {/* --- CURRENCY ROW --- */}
            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={openCurrencyModal}
            >
              <View style={styles.settingsRowLeft}>
                <View
                  style={[
                    styles.settingsIcon,
                    { backgroundColor: colors.secondaryContainer + "1A" },
                  ]}
                >
                  <Ionicons
                    name="card-outline"
                    size={18}
                    color={colors.secondary}
                  />
                </View>
                <View>
                  <Text style={[styles.settingsLabel, { color: colors.onSurface }]}>
                    {t("settings.display_currency")}
                  </Text>
                  {ratesError && (
                    <Text style={styles.ratesWarning}>
                      ⚠ {t("settings.rates_error")}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.currencyTrailing}>
                <Text style={[styles.trailingText, { color: colors.onSurfaceVariant }]}>
                  {currentCurrency.symbol} {currentCurrency.iso}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.outline}
                />
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant + "33" }]} />

            {/* --- LANGUAGE ROW --- */}
            <TouchableOpacity
              onPress={openLanguageModal}
              activeOpacity={0.7}
            >
              <SettingsRow
                styles={styles}
                colors={colors}
                icon="language-outline"
                iconBg={colors.tertiaryContainer + "1A"}
                iconColor={colors.tertiaryFixedDim}
                label={t("settings.language")}
                trailing={
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Text style={[styles.trailingText, { color: colors.onSurfaceVariant }]}>
                      {i18n.language.startsWith("tr") ? "Türkçe" : "English"}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.outline}
                    />
                  </View>
                }
              />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.outlineVariant + "33" }]} />

            <SettingsRow
                styles={styles}
                colors={colors}
              icon="moon-outline"
              iconBg={colors.primaryContainer + "1A"}
              iconColor={colors.primary}
              label={t("settings.dark_mode")}
              trailing={
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{
                    false: colors.surfaceContainerHighest,
                    true: colors.tertiaryFixed,
                  }}
                  thumbColor="#fff"
                />
              }
            />
          </View>
        </View>

        {/* Automation Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.automation_section")}
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(app)/bill-import")}
            >
              <SettingsRow
                styles={styles}
                colors={colors}
                icon="mail-unread-outline"
                iconBg={colors.tertiaryContainer + "1A"}
                iconColor={colors.tertiary}
                label={t("settings.bill_import")}
                trailing={
                  <View style={styles.currencyTrailing}>
                    <Text style={[styles.trailingText, { color: colors.onSurfaceVariant }]}>
                      {t("settings.bill_import_status")}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.outline}
                    />
                  </View>
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.notifications_section")}
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <SettingsRow
                styles={styles}
                colors={colors}
              icon="notifications-outline"
              iconBg={colors.errorContainer + "1A"}
              iconColor={colors.error}
              label={t("settings.push_alerts")}
              trailing={
                <Switch
                  value={pushAlerts}
                  onValueChange={handlePushAlertsChange}
                  trackColor={{
                    false: colors.surfaceContainerHighest,
                    true: colors.tertiaryFixed,
                  }}
                  thumbColor="#fff"
                />
              }
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.security_section")}
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <TouchableOpacity onPress={openChangePasswordModal} activeOpacity={0.7}>
              <SettingsRow
                  styles={styles}
                  colors={colors}
                icon="lock-closed-outline"
                iconBg={colors.outlineVariant + "33"}
                iconColor={colors.onSurface}
                label={t("settings.change_password")}
                trailing={
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.outline}
                  />
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
            {t("settings.support_section")}
          </Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <SettingsRow
                styles={styles}
                colors={colors}
              icon="help-circle-outline"
              iconBg={colors.surfaceContainerHighest}
              iconColor={colors.onSurfaceVariant}
              label={t("settings.help_center")}
              trailing={
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={colors.outline}
                />
              }
            />
            <View style={[styles.divider, { backgroundColor: colors.outlineVariant + "33" }]} />
            <SettingsRow
                styles={styles}
                colors={colors}
              icon="shield-checkmark-outline"
              iconBg={colors.surfaceContainerHighest}
              iconColor={colors.onSurfaceVariant}
              label={t("settings.privacy_policy")}
              trailing={
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.outline}
                />
              }
            />
          </View>
        </View>

        <Text style={[styles.version, { color: colors.outlineVariant }]}>{t("settings.app_version")}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── CURRENCY PICKER MODAL ── */}
      <Modal
        visible={currencyModalVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeCurrencyModal}
      >
        <GestureHandlerRootView style={styles.modalOverlay}>
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.currencyActionBackdrop,
              { backgroundColor: currencySheetColors.backdrop },
              currencyBackdropAnimatedStyle,
            ]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCurrencyModal} />
          <GestureDetector gesture={currencyPanGesture}>
            <Reanimated.View
              style={[
                styles.currencyActionSheet,
                { backgroundColor: currencySheetColors.sheet },
                { paddingBottom: Math.max(insets.bottom, 12) },
                currencySheetAnimatedStyle,
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.currencyActionBottomFill,
                  { backgroundColor: currencySheetColors.sheet },
                ]}
              />
              <PreferencePickerContent
                styles={styles}
                sheetColors={currencySheetColors}
                title={t("settings.display_currency")}
                sectionLabel={isTurkish ? "Para birimini seç" : "Choose currency"}
                options={currencyOptions}
              />
            </Reanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      {/* ── YENİ: LANGUAGE PICKER MODAL ── */}
      <Modal
        visible={languageModalVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeLanguageModal}
      >
        <GestureHandlerRootView style={styles.modalOverlay}>
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.currencyActionBackdrop,
              { backgroundColor: currencySheetColors.backdrop },
              languageBackdropAnimatedStyle,
            ]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeLanguageModal} />
          <GestureDetector gesture={languagePanGesture}>
            <Reanimated.View
              style={[
                styles.currencyActionSheet,
                { backgroundColor: currencySheetColors.sheet },
                { paddingBottom: Math.max(insets.bottom, 12) },
                languageSheetAnimatedStyle,
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.currencyActionBottomFill,
                  { backgroundColor: currencySheetColors.sheet },
                ]}
              />
              <PreferencePickerContent
                styles={styles}
                sheetColors={currencySheetColors}
                title={t("settings.language")}
                sectionLabel={isTurkish ? "Dili seç" : "Choose language"}
                options={languageOptions}
              />
            </Reanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal
        visible={changePasswordVisible}
        animationType="none"
        transparent
        statusBarTranslucent
        onRequestClose={closeChangePasswordModal}
      >
        <GestureHandlerRootView style={styles.modalOverlay}>
          <Reanimated.View
            pointerEvents="none"
            style={[
              styles.currencyActionBackdrop,
              { backgroundColor: currencySheetColors.backdrop },
              passwordBackdropAnimatedStyle,
            ]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeChangePasswordModal} />
          <GestureDetector gesture={passwordPanGesture}>
            <Reanimated.View
              style={[
                styles.modalSheet,
                { backgroundColor: colors.surface },
                { paddingBottom: Math.max(insets.bottom + 30, 48) },
                passwordSheetAnimatedStyle,
              ]}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.passwordSheetBottomFill,
                  { backgroundColor: colors.surface },
                ]}
              />
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={styles.modalHandleArea}>
                  <View style={styles.modalHandle} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  {t("settings.change_password")}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.onSurfaceVariant }]}>
                  {t("settings.change_password_subtitle")}
                </Text>

              {/* Current Password */}
              <View style={[styles.passwordField, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.outline} />
                <TextInput
                  style={[styles.passwordInput, { color: colors.onSurface }]}
                  placeholder={t("settings.change_password_current")}
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrent((v) => !v)}>
                  <Ionicons
                    name={showCurrent ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <View style={[styles.passwordField, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="key-outline" size={18} color={colors.outline} />
                <TextInput
                  style={[styles.passwordInput, { color: colors.onSurface }]}
                  placeholder={t("settings.change_password_new")}
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNew((v) => !v)}>
                  <Ionicons
                    name={showNew ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm New Password */}
              <View style={[styles.passwordField, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Ionicons name="key-outline" size={18} color={colors.outline} />
                <TextInput
                  style={[styles.passwordInput, { color: colors.onSurface }]}
                  placeholder={t("settings.change_password_confirm")}
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                  <Ionicons
                    name={showConfirm ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.passwordSaveBtn,
                  { backgroundColor: colors.primary },
                  passwordLoading && { opacity: 0.6 },
                ]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.passwordSaveBtnText}>
                  {passwordLoading ? t("common.loading") : t("common.save")}
                </Text>
              </TouchableOpacity>
              </TouchableOpacity>
            </Reanimated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>

      <AppTabBar />
    </View>
  );
}

// ── Küçük yardımcı bileşen ──
function SettingsRow({
  styles,
  colors,
  icon,
  iconBg,
  iconColor,
  label,
  trailing,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  trailing: ReactNode;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>
        <View style={[styles.settingsIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
        </View>
        <Text style={[styles.settingsLabel, { color: colors.onSurface }]}>{label}</Text>
      </View>
      {trailing}
    </View>
  );
}

function PreferencePickerContent({
  styles,
  sheetColors,
  title,
  sectionLabel,
  options,
}: {
  styles: ReturnType<typeof createStyles>;
  sheetColors: Record<string, string>;
  title: string;
  sectionLabel: string;
  options: PickerOption[];
}) {
  return (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.preferenceSheetScroll}
    >
      <View style={styles.currencyActionHandleArea}>
        <View
          style={[
            styles.currencyActionHandle,
            { backgroundColor: sheetColors.handle },
          ]}
        />
      </View>

      <View style={styles.preferenceIntro}>
        <Text style={[styles.preferenceTitle, { color: sheetColors.title }]}>
          {title}
        </Text>
      </View>

      <View
        style={[
          styles.preferenceDivider,
          { backgroundColor: sheetColors.divider },
        ]}
      />

      <Text
        style={[
          styles.preferenceSectionLabel,
          { color: sheetColors.sectionLabel },
        ]}
      >
        {sectionLabel}
      </Text>

      <View style={styles.preferenceOptionList}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.preferenceOption,
              {
                backgroundColor: option.selected
                  ? sheetColors.selectedRow
                  : sheetColors.card,
                borderColor: option.selected
                  ? sheetColors.selectedBorder
                  : sheetColors.cardBorder,
              },
            ]}
            activeOpacity={0.78}
            onPress={option.onPress}
          >
            <View
              style={[
                styles.preferenceOptionAccent,
                {
                  backgroundColor: option.selected
                    ? sheetColors.accent
                    : "transparent",
                },
              ]}
            />
            <View
              style={[
                styles.preferenceOptionGlyph,
                {
                  backgroundColor: option.selected
                    ? sheetColors.selectedIconBg
                    : sheetColors.iconBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.preferenceOptionGlyphText,
                  {
                    color: option.selected
                      ? sheetColors.selectedIconText
                      : sheetColors.iconText,
                  },
                ]}
              >
                {option.glyph}
              </Text>
            </View>

            <View style={styles.preferenceOptionCopy}>
              <Text
                style={[
                  styles.preferenceOptionTitle,
                  { color: sheetColors.rowText },
                ]}
              >
                {option.title}
              </Text>
            </View>

            <View
              style={[
                styles.preferenceOptionCheck,
                {
                  backgroundColor: option.selected
                    ? sheetColors.checkBg
                    : "transparent",
                  borderColor: option.selected
                    ? sheetColors.checkBg
                    : sheetColors.cardBorder,
                },
              ]}
            >
              {option.selected && (
                <Ionicons
                  name="checkmark"
                  size={15}
                  color={sheetColors.checkColor}
                />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: Spacing.xxl },
  // Frosted Glass Header
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkMode ? "rgba(16, 18, 22, 0.05)" : "rgba(255, 248, 255, 0.05)",
  },
  headerBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: darkMode ? "rgba(242, 244, 251, 0.08)" : "rgba(25, 27, 34, 0.08)",
  },
  headerContent: {
    paddingHorizontal: 24,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: { ...Typography.headlineLg, color: colors.onSurface },

  section: { marginBottom: Spacing.xxl },
  sectionLabel: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
    letterSpacing: 2,
    marginBottom: Spacing.md,
    paddingLeft: 2,
  },

  // Profile
  profileCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  profileEditBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.headlineSm, color: colors.onSurface },
  profileEmail: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  profileAction: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    flexShrink: 0,
  },
  profileActionDanger: {
    backgroundColor: colors.errorContainer + "33",
  },
  profileActionPrimary: {
    backgroundColor: colors.primaryContainer + "1A",
  },
  profileActionText: {
    ...Typography.labelSm,
    fontWeight: "700",
  },
  profileActionTextDanger: {
    color: colors.error,
  },
  profileActionTextPrimary: {
    color: colors.primary,
  },

  // Settings card
  settingsCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.xxl,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  settingsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: { ...Typography.labelLg, color: colors.onSurface },
  trailingText: {
    ...Typography.labelMd,
    color: colors.onSurfaceVariant,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.outlineVariant + "1A",
    marginHorizontal: Spacing.lg,
  },
  currencyTrailing: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratesWarning: { ...Typography.labelSm, color: colors.error, marginTop: 1 },

  // Sign Out
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: colors.errorContainer + "33",
    borderRadius: BorderRadius.xxl,
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  signOutText: {
    ...Typography.labelLg,
    color: colors.error,
    fontWeight: "700",
  },
  version: {
    ...Typography.bodySm,
    color: colors.outlineVariant,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(25, 27, 34, 0.38)",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "visible",
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 48,
  },
  passwordSheetBottomFill: {
    position: "absolute",
    left: -Spacing.xxl,
    right: -Spacing.xxl,
    bottom: -260,
    height: 260,
  },
  modalHandleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
  modalTitle: {
    ...Typography.headlineLg,
    color: colors.onSurface,
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  preferenceSheetScroll: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  preferenceIntro: {
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
  },
  preferenceTitle: {
    ...Typography.headlineMd,
    fontWeight: "800",
  },
  preferenceDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  preferenceSectionLabel: {
    ...Typography.labelSm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    letterSpacing: 1.2,
  },
  preferenceOptionList: {
    gap: Spacing.sm,
  },
  preferenceOption: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    overflow: "hidden",
    position: "relative",
    shadowColor: colors.onSurface,
    shadowOpacity: darkMode ? 0 : 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  preferenceOptionAccent: {
    position: "absolute",
    left: 0,
    top: Spacing.md,
    bottom: Spacing.md,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  preferenceOptionGlyph: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  preferenceOptionGlyphText: {
    ...Typography.headlineSm,
    fontWeight: "800",
  },
  preferenceOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  preferenceOptionTitle: {
    ...Typography.labelLg,
    fontWeight: "800",
  },
  preferenceOptionCheck: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  currencyActionBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  currencyActionSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "visible",
    maxHeight: "88%",
    paddingTop: Spacing.lg,
  },
  currencyActionBottomFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -CURRENCY_SHEET_BOTTOM_FILL_HEIGHT,
    height: CURRENCY_SHEET_BOTTOM_FILL_HEIGHT,
  },
  currencyActionHandleArea: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: Spacing.sm,
  },
  currencyActionHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },

  // Password change
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  passwordInput: {
    flex: 1,
    ...Typography.bodyLg,
    color: colors.onSurface,
  },
  passwordSaveBtn: {
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  passwordSaveBtnText: {
    ...Typography.labelLg,
    color: "#fff",
    fontWeight: "700",
  },
});
