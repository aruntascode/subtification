import SubscriptionIcon from "@/components/SubscriptionIcon";
import InstallmentSummaryCard from "@/components/home/InstallmentSummaryCard";
import MonthProgressCard from "@/components/home/MonthProgressCard";
import PaymentCalendarStrip, {
  CALENDAR_NEXT_MONTH_DAYS,
} from "@/components/home/PaymentCalendarStrip";
import { getPaymentsInMonth } from "@/lib/paymentSchedule";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrency, useTotalMonthly } from "@/hooks/useCurrency";
import { useAuthStore } from "@/stores/authStore";
import { isOverBudget, useBudgetStore } from "@/stores/budgetStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { fmtDisplay, fmtWithOriginal } = useCurrency();
  const monthlyConverted = useTotalMonthly();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, darkMode),
    [colors, darkMode],
  );

  const budgetLimit = useBudgetStore((state) => state.limit);
  const budgetEnabled = useBudgetStore((state) => state.enabled);

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

  // "Bu ay" kartı yalnızca bu ayı, takvim şeridi ek olarak sonraki ayın ilk 15 gününü gösterir
  const { monthPayments, calendarPayments } = useMemo(() => {
    const now = new Date();
    const current = getPaymentsInMonth(subscriptions, now.getFullYear(), now.getMonth());
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthHead = getPaymentsInMonth(
      subscriptions,
      next.getFullYear(),
      next.getMonth(),
    ).filter((p) => p.date.getDate() <= CALENDAR_NEXT_MONTH_DAYS);
    return { monthPayments: current, calendarPayments: [...current, ...nextMonthHead] };
  }, [subscriptions]);

  // YENİ: Listeyi ters çevirip sadece en son eklenen 3 aboneliği alıyoruz
  const recentSubs = [...subscriptions].reverse().slice(0, 3);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      HOME_TAB_PRESS_EVENT,
      () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
    );

    return () => subscription.remove();
  }, []);

  const overBudget = isOverBudget(monthlyConverted, budgetLimit, budgetEnabled);

  const heroGradientColors: [string, string] = [
    colors.heroGradientStart,
    colors.heroGradientEnd,
  ];

  // Analizlerdeki bütçe kartına git ve limit alanını odakla
  const handleEditBudget = () => {
    router.replace({ pathname: "/(app)/analytics", params: { focus: "budget" } });
  };

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
            {upcoming.length > 0 && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {getUpcomingBadgeLabel()}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Bütçe aşıldıysa aylık harcamanın altında ayrı uyarı */}
          {overBudget && (
            <View style={styles.budgetAlert}>
              <View style={styles.budgetAlertIcon}>
                <Ionicons name="warning-outline" size={18} color={colors.error} />
              </View>
              <View style={styles.budgetAlertText}>
                <Text style={styles.budgetAlertTitle}>
                  {t("dashboard.budget_warning")}
                </Text>
                <Text style={styles.budgetAlertBody}>
                  {t("dashboard.budget_over_by", {
                    amount: fmtDisplay(monthlyConverted - budgetLimit),
                    limit: fmtDisplay(budgetLimit),
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.budgetAlertButton}
                onPress={handleEditBudget}
                activeOpacity={0.75}
              >
                <Text style={styles.budgetAlertButtonText}>
                  {t("dashboard.budget_edit")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!user && (
            <View style={styles.guestNotice}>
              <View style={styles.guestNoticeTop}>
                <View style={styles.guestNoticeIcon}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.guestNoticeTextBlock}>
                  <Text style={styles.guestNoticeTitle}>
                    {t("guest_notice.title")}
                  </Text>
                  <Text style={styles.guestNoticeBody}>
                    {t("guest_notice.body")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.guestNoticeButton}
                onPress={() => router.push("/(auth)/login")}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="mail-outline"
                  size={17}
                  color={colors.primary}
                />
                <Text style={styles.guestNoticeButtonText}>
                  {t("guest_notice.sign_in_cta")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {subscriptions.length > 0 && (
            <>
              {/* Bu ay ödenen / kalan */}
              <MonthProgressCard payments={monthPayments} />

              {/* Ayın ödeme takvimi (eski 7 günlük yaklaşan ödemeler kartlarının yerine) */}
              <PaymentCalendarStrip
                payments={calendarPayments}
                onPressSubscription={handleNavigateToDetail}
              />

              {/* Aktif taksitler; yoksa hiç görünmez */}
              <InstallmentSummaryCard
                subscriptions={subscriptions}
                onPressSubscription={handleNavigateToDetail}
              />
            </>
          )}

          {/* Recent Subs (Son Eklenen 3 Abonelik) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("dashboard.recent_subs")}
              </Text>
              {recentSubs.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push("/(app)/(home)/subscriptions-list")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>
                    {t("dashboard.view_all")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {recentSubs.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="albums-outline"
                    size={28}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>{t("dashboard.no_subs_title")}</Text>
                <Text style={styles.emptyDesc}>{t("dashboard.no_subs_desc")}</Text>

                <View style={styles.emptyFeatureRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.tertiaryFixedDim}
                  />
                  <Text style={styles.emptyFeatureText}>
                    {t("dashboard.feature_track")}
                  </Text>
                </View>
                <View style={styles.emptyFeatureRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.tertiaryFixedDim}
                  />
                  <Text style={styles.emptyFeatureText}>
                    {t("dashboard.feature_notify")}
                  </Text>
                </View>

                {/* Yeni kullanıcı için ana yol: servisleri tek seferde seç */}
                <TouchableOpacity
                  onPress={() => router.push("/(app)/bulk-add")}
                  activeOpacity={0.9}
                  style={styles.primaryCtaWrapper}
                >
                  <LinearGradient
                    colors={[colors.primarySolid, colors.primarySolidContainer]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryCta}
                  >
                    <Ionicons name="apps" size={20} color="#fff" />
                    <Text style={styles.primaryCtaText}>
                      {t("bulk.empty_cta")}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/(app)/new")}
                  activeOpacity={0.7}
                  style={styles.secondaryCta}
                >
                  <Text style={styles.secondaryCtaText}>
                    {t("bulk.empty_single")}
                  </Text>
                </TouchableOpacity>

              </View>
            ) : recentSubs.map((sub) => {
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
                        {fmtWithOriginal(sub.amount, sub.currency || "₺")}
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
      ...StyleSheet.absoluteFill,
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
    budgetAlert: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      backgroundColor: colors.errorContainer + (darkMode ? "40" : "80"),
      borderRadius: 20,
      padding: Spacing.lg,
      marginTop: -Spacing.lg,
      marginBottom: Spacing.xxxl,
    },
    budgetAlertIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.errorContainer,
    },
    budgetAlertText: {
      flex: 1,
    },
    budgetAlertTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
    },
    budgetAlertBody: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    budgetAlertButton: {
      backgroundColor: colors.error,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    budgetAlertButtonText: {
      ...Typography.labelMd,
      color: colors.onError,
      fontWeight: "800",
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
    guestNotice: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: Spacing.lg,
      marginBottom: Spacing.xxxl,
      shadowColor: colors.onSurface,
      shadowOpacity: 0.04,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    guestNoticeTop: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    guestNoticeIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryFixed,
    },
    guestNoticeTextBlock: {
      flex: 1,
    },
    guestNoticeTitle: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
      marginBottom: 4,
    },
    guestNoticeBody: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
    },
    guestNoticeButton: {
      minHeight: 42,
      borderRadius: BorderRadius.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      backgroundColor: colors.surfaceContainerLow,
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    guestNoticeButtonText: {
      ...Typography.labelMd,
      color: colors.primary,
      fontWeight: "800",
    },

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
      backgroundColor: colors.surfaceContainerHigh,
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
    emptyCard: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 24,
      padding: Spacing.xl,
      shadowColor: colors.onSurface,
      shadowOpacity: 0.04,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryFixed,
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      fontWeight: "800",
      marginBottom: Spacing.sm,
    },
    emptyDesc: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
    emptyFeatureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    emptyFeatureText: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      flex: 1,
    },
    primaryCtaWrapper: {
      marginTop: Spacing.lg,
      borderRadius: BorderRadius.full,
      overflow: "hidden",
    },
    primaryCta: {
      minHeight: 52,
      borderRadius: BorderRadius.full,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
    },
    primaryCtaText: {
      ...Typography.labelLg,
      color: "#ffffff",
      fontWeight: "800",
    },
    secondaryCta: {
      marginTop: Spacing.sm,
      paddingVertical: Spacing.md,
      alignItems: "center",
    },
    secondaryCtaText: {
      ...Typography.labelLg,
      color: colors.primary,
      fontWeight: "700",
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
