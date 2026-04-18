import SubscriptionIcon from "@/components/SubscriptionIcon";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrency, useTotalMonthly } from "@/hooks/useCurrency";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HOME_TAB_PRESS_EVENT = "homeTabPress";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets(); // YENİ: Cihazın çentik boşluğunu hesaplar
  const { subscriptions, loading, fetchSubscriptions, upcomingPayments } =
    useSubscriptionStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { fmt, fmtDisplay, fmtWithOriginal } = useCurrency();
  const monthlyConverted = useTotalMonthly();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, darkMode),
    [colors, darkMode],
  );

  const [budgetLimit, setBudgetLimit] = useState(0);

  const onRefresh = useCallback(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const getDaysUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  // YENİ: Sadece ödemesine 7 gün veya daha az kalanları filtreler
  const upcoming = upcomingPayments().filter(
    (sub) => getDaysUntil(sub.next_billing_date) <= 7,
  );

  // YENİ: Listeyi ters çevirip sadece en son eklenen 3 aboneliği alıyoruz
  const recentSubs = [...subscriptions].reverse().slice(0, 3);

  useEffect(() => {
    AsyncStorage.getItem("budget_limit").then((val) => {
      if (val) setBudgetLimit(parseFloat(val) || 0);
    });
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      HOME_TAB_PRESS_EVENT,
      () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
    );

    return () => subscription.remove();
  }, []);

  const isOverBudget = budgetLimit > 0 && monthlyConverted > budgetLimit;

  const heroGradientColors: [string, string] = isOverBudget
    ? ["#c0392b", "#e74c3c"]
    : [colors.primary, colors.primaryContainer];

  const getUpcomingBadgeLabel = () => {
    if (upcoming.length === 0) return "";
    const days = getDaysUntil(upcoming[0].next_billing_date);
    const locale = (() => {
      try {
        return Localization.getLocales()[0]?.languageTag ?? "en";
      } catch {
        return "en";
      }
    })();
    const dateLabel =
      days <= 7
        ? t("dashboard.next_payment", { name: upcoming[0].name, days })
        : new Date(upcoming[0].next_billing_date).toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
          });
    return days <= 7 ? dateLabel : `${upcoming[0].name} • ${dateLabel}`;
  };

  // ── NAVIGATION FIX ──
  // Detay sayfasının sağdan sola kayarak açılması için doğru stack yolunu kullanıyoruz
  const handleNavigateToDetail = (id: string) => {
    router.push(`/(app)/subscription/${id}`);
  };

  if (subscriptions.length === 0 && !loading) {
    // ... (Empty state kodun aynı kalabilir, değişmedi)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        {/* Buzlu cam katmanı — içerik bu cam arkaplanın altından kayar */}
        <BlurView
          intensity={72}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
        />
        {/* Hafif beyaz örtü — %82 opasite, cam hissi için */}
        <View style={styles.headerOverlay} />
        {/* İnce alt border — cam kenarını tanımlar */}
        <View style={styles.headerBorder} />

        <View style={styles.headerContent}>
          <Text style={styles.brandName}>Subtification</Text>
          <TouchableOpacity
            onPress={() => router.push("/(app)/settings")}
            style={styles.settingsBtn}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* YENİ EKLENEN KAPSAYICI */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 64 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Hero Card */}
          <LinearGradient
            colors={heroGradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>
              {t("dashboard.monthly_spending")}
            </Text>
            <Text style={styles.heroAmount}>
              {fmtDisplay(monthlyConverted)}
            </Text>
            {isOverBudget && (
              <Text style={styles.budgetWarning}>
                {t("dashboard.budget_warning")}
              </Text>
            )}
            {upcoming.length > 0 && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {getUpcomingBadgeLabel()}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Upcoming Payments (Yaklaşan Ödemeler - Max 7 Gün) */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              {/* Başlığı sectionHeader içine alarak alt boşluğu (16px) eşitledik */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t("dashboard.upcoming")}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.upcomingScroll}
              >
                {upcoming.map((sub) => {
                  // Stitch tarzı "12 Eki" veya "Oct 12" formatı
                  const locale = i18n.language.startsWith("tr")
                    ? "tr-TR"
                    : "en-US";
                  const formattedDate = new Date(sub.next_billing_date)
                    .toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                    })
                    .toUpperCase();

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      style={styles.upcomingCard}
                      onPress={() => handleNavigateToDetail(sub.id)}
                    >
                      {/* Üst Kısım: İkon ve Tarih Rozeti */}
                      <View style={styles.upcomingTopRow}>
                        <SubscriptionIcon
                          value={sub.emoji}
                          bgColor={sub.color}
                          size={24} // 20'den 24'e çıkardık (Alttaki listeyle aynı)
                          containerSize={48} // 40'tan 48'e çıkardık
                          radius={14} // Kenar kıvrımını da oranladık
                        />
                        <View style={styles.upcomingBadge}>
                          <Text style={styles.upcomingBadgeText}>
                            {formattedDate}
                          </Text>
                        </View>
                      </View>

                      {/* Alt Kısım: Servis Adı ve Fiyat */}
                      <View style={styles.upcomingBottomRow}>
                        <Text style={styles.upcomingName} numberOfLines={1}>
                          {sub.name}
                        </Text>
                        <Text style={styles.upcomingAmount}>
                          {fmtWithOriginal(sub.amount, sub.currency || "₺")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Recent Subs (Son Eklenen 3 Abonelik) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("dashboard.recent_subs")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(app)/(home)/subscriptions-list")}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>
                  {t("dashboard.view_all")}
                </Text>
              </TouchableOpacity>
            </View>

            {recentSubs.map((sub) => {
              // 1. Kategorinin görünen adını buluyoruz
              const categoryLabel = t(`categories.${sub.category}`);

              // 2. Ödeme gününü ismen (Pazartesi, Salı vb.) buluyoruz
              const locale = i18n.language.startsWith("tr") ? "tr-TR" : "en-US";
              const dayName = new Date(
                sub.next_billing_date,
              ).toLocaleDateString(locale, { weekday: "long" });

              // İlk harfi büyük yapmak için küçük bir dokunuş
              const formattedDay =
                dayName.charAt(0).toUpperCase() + dayName.slice(1);

              return (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.activeRow}
                  onPress={() => handleNavigateToDetail(sub.id)}
                >
                  <View style={styles.activeLeft}>
                    <SubscriptionIcon
                      value={sub.emoji}
                      bgColor={sub.color}
                      size={24} // İkonu bir tık büyüttük
                      containerSize={48}
                      radius={14}
                    />
                    <View style={styles.activeTextContainer}>
                      <Text style={styles.activeName}>{sub.name}</Text>
                      <Text style={styles.activeMeta}>
                        {categoryLabel} • {formattedDay}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.activeRight}>
                    {/* Fiyatı Stitch tasarımındaki gibi daha koyu yaptık */}
                    <Text style={styles.activeAmount}>
                      {fmt(sub.amount, sub.currency || "₺")}
                    </Text>
                    {/* Tasarımdaki yeşil AUTO-PAY detayını yansıtıyoruz */}
                    <Text
                      style={[
                        styles.payStatus,
                        !sub.is_active && styles.payStatusManual,
                      ]}
                    >
                      {sub.is_active ? "OTOMATİK" : "MANUEL"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    // ScrollView içeriğini yüzen header'ın arkasında kalmaması için aşağı itiyoruz
    scrollContent: {
      paddingHorizontal: Spacing.xxl,
      paddingTop: 80,
    },

    // FROSTED GLASS HEADER
    headerWrapper: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      overflow: "hidden", // BlurView'ün taşmasını önler
    },
    headerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: darkMode
        ? "rgba(16, 18, 22, 0.05)"
        : "rgba(255, 248, 255, 0.05)",
    },
    headerBorder: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: darkMode
        ? "rgba(242, 244, 251, 0.08)"
        : "rgba(25, 27, 34, 0.08)",
    },
    headerContent: {
      paddingHorizontal: 24,
      height: 56,
      justifyContent: "center",
    },
    settingsBtn: {
      position: "absolute",
      right: 20,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      padding: 8,
      zIndex: 10,
    },

    brandName: { ...Typography.headlineLg, color: colors.primary },
    heroCard: {
      borderRadius: BorderRadius.xxxl,
      paddingHorizontal: Spacing.xxl,
      paddingVertical: Spacing.lg,
      marginBottom: Spacing.xxxl, // <-- 24'ten 32'ye çıkardık (Spacing.xxxl)
    },
    heroLabel: {
      ...Typography.labelSm,
      color: "rgba(255,255,255,0.7)",
      marginBottom: Spacing.sm,
    },
    heroAmount: { ...Typography.displayLg, color: "#ffffff" },
    budgetWarning: {
      ...Typography.labelMd,
      color: "#ffffff",
      marginTop: Spacing.sm,
      opacity: 0.9,
    },
    heroBadge: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      alignSelf: "flex-start",
      marginTop: Spacing.md,
    },
    heroBadgeText: { ...Typography.labelMd, color: "#ffffff" },

    // Section Styles
    // Section Styles
    section: {
      marginBottom: Spacing.xxxl, // <-- 24'ten 32'ye çıkardık (Spacing.xxxl)
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.lg, // Bu zaten 16px, artık her iki başlık da bunu kullanıyor
    },
    sectionTitle: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      fontWeight: "800", // Başlığı biraz daha belirgin yaptık
    },
    viewAllText: {
      ...Typography.labelMd,
      color: colors.primary,
      fontWeight: "700",
    },
    upcomingScroll: {
      marginHorizontal: -Spacing.xxl,
      paddingHorizontal: Spacing.xxl,
    },
    upcomingCard: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: 16,
      marginRight: Spacing.md,
      width: 160, // 140'tan 160'a çıkardık. Kutu biraz daha dolgun duracak.
      justifyContent: "space-between",
      shadowColor: colors.onSurface,
      shadowOpacity: 0.04,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    upcomingTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      width: "100%",
    },
    upcomingBadge: {
      backgroundColor: colors.surfaceContainerHigh, // Stitch tarzı çok hafif gri/mor arkaplan
      borderRadius: BorderRadius.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    upcomingBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.onSurfaceVariant,
      letterSpacing: 0.5,
    },
    upcomingBottomRow: {
      width: "100%",
      marginTop: 16,
      alignItems: "flex-start",
    },
    upcomingName: {
      ...Typography.labelLg, // labelMd'den labelLg'ye yükselttik (Alttaki listeyle aynı büyüklük)
      color: colors.onSurfaceVariant,
      marginBottom: 4,
    },
    upcomingAmount: {
      ...Typography.headlineSm,
      color: colors.onSurface, // Fiyat vurgulu ve koyu renk
      fontWeight: "800",
    },
    activeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20, // Tasarımdaki gibi daha yumuşak bir kavis
      padding: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    activeLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.lg,
      flex: 1,
    },
    activeTextContainer: {
      flex: 1,
      paddingRight: 8,
    },
    activeName: {
      ...Typography.labelLg,
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
    },
    activeMeta: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 4,
    },
    activeRight: {
      alignItems: "flex-end",
    },
    activeAmount: {
      ...Typography.headlineSm,
      fontSize: 18,
      color: colors.onSurface, // Koyu premium görünüm
    },
    payStatus: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.tertiaryContainer, // Yeşil tonu (AUTO-PAY için)
      marginTop: 4,
      letterSpacing: 0.5,
    },
    payStatusManual: {
      color: colors.outline, // Gri tonu (MANUEL için)
    },
  });
