import { CATEGORIES } from "@/constants/categories";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useCurrency, useTotalMonthly, useCategoryTotals } from "@/hooks/useCurrency";
import { isBilling } from "@/lib/subscriptionDuration";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore, Subscription } from "@/stores/subscriptionStore";
import SubscriptionIcon from "@/components/SubscriptionIcon";
import { Ionicons } from "@expo/vector-icons";
import { isOverBudget, useBudgetStore } from "@/stores/budgetStore";
import { pickGeneralTips } from "@/constants/savingsTips";
import { findYearlyAlternative } from "@/constants/services";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  DeviceEventEmitter,
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";
import { KEYBOARD_DONE_ID } from "@/components/KeyboardDoneBar";

// ---------- helpers ----------

const getCategoryColor = (catId: string, colors: AppColors) =>
  CATEGORIES.find((c) => c.id === catId)?.color ?? colors.outline;

const sanitizeAmountInput = (value: string) => {
  const normalized = value.replace(",", ".");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const digitsOnly = whole.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "");

  return decimalParts.length > 0 ? `${digitsOnly}.${decimal}` : digitsOnly;
};

/** Normalize any cycle to monthly amount */
function toMonthly(amount: number, cycle: string): number {
  switch (cycle) {
    case "weekly": return amount * 4.333;
    case "quarterly": return amount / 3;
    case "yearly": return amount / 12;
    default: return amount;
  }
}

/** Days until a date from today */
function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type SubscriptionWithMonthly = Subscription & { monthlyConverted: number };

type SavingsTip = {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** Genel ipuçlarında tutar yok; satır gizlenir */
  monthlySavings?: number;
  yearlySavings?: number;
  /** İpucunu tek dokunuşla uygulamak için (örn. "Yıllığa geç") */
  action?: { label: string; onPress: () => void };
};
const ANALYTICS_TAB_PRESS_EVENT = "analyticsTabPress";

// ---------- component ----------

export default function AnalyticsScreen() {
  const { subscriptions } = useSubscriptionStore();
  const { fmtDisplay, fmtWithOriginal, convert, displayCurrency } = useCurrency();
  const categoryTotals = useCategoryTotals();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);

  const monthly = useTotalMonthly();
  const yearly = monthly * 12;
  const daily = monthly / 30;
  const activeSubs = subscriptions.filter(isBilling);
  const pausedSubs = subscriptions.filter((s) => !s.is_active);

  const activeWithMonthly: SubscriptionWithMonthly[] = activeSubs.map((s) => ({
    ...s,
    monthlyConverted: convert(
      toMonthly(s.amount, s.billing_cycle),
      s.currency ?? "₺",
      displayCurrency,
    ),
  }));

  // Top 5 most expensive (normalized to monthly, in display currency)
  const topExpensive = [...activeWithMonthly]
    .sort((a, b) => b.monthlyConverted - a.monthlyConverted)
    .slice(0, 5);

  // Billing cycle distribution
  const cycleCounts = activeSubs.reduce(
    (acc, s) => {
      acc[s.billing_cycle] = (acc[s.billing_cycle] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const cycleLabels: Record<string, string> = {
    weekly: t("analytics.cycle_weekly"),
    monthly: t("analytics.cycle_monthly"),
    quarterly: t("analytics.cycle_quarterly"),
    yearly: t("analytics.cycle_yearly"),
  };

  // Upcoming payments (next 30 days)
  const upcoming = [...activeSubs]
    .filter((s) => {
      const d = daysUntil(s.next_billing_date);
      return d >= 0 && d <= 30;
    })
    .sort(
      (a, b) =>
        new Date(a.next_billing_date).getTime() -
        new Date(b.next_billing_date).getTime(),
    );

  // Donut chart mode: "subscriptions" | "categories"
  const [donutMode, setDonutMode] = useState<"subscriptions" | "categories">("subscriptions");
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [btnWidth, setBtnWidth] = useState(0);
  const savedBudgetLimit = useBudgetStore((state) => state.limit);
  const setSavedBudgetLimit = useBudgetStore((state) => state.setLimit);
  // Kayıtlı limit bellekte hazır; ekran ilk karede doğru hâliyle çizilir
  const [budgetLimitInput, setBudgetLimitInput] = useState(() =>
    savedBudgetLimit > 0 ? savedBudgetLimit.toString() : "",
  );
  const [budgetSaved, setBudgetSaved] = useState(false);
  const budgetInputRef = useRef<TextInput>(null);

  const budgetEnabled = useBudgetStore((state) => state.enabled);
  const setBudgetEnabled = useBudgetStore((state) => state.setEnabled);
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const budgetLimit = parseFloat(budgetLimitInput) || 0;
  const budgetUsagePct =
    budgetLimit > 0 ? Math.min((monthly / budgetLimit) * 100, 100) : 0;
  const budgetRemaining = Math.max(budgetLimit - monthly, 0);
  const overBudget = isOverBudget(monthly, budgetLimit, budgetEnabled);

  // Ana sayfadaki "Değiştir"den gelindiyse limit alanını odakla
  useEffect(() => {
    if (focus !== "budget") return;
    const timer = setTimeout(() => budgetInputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [focus]);

  const handleToggleBudget = (enabled: boolean) => {
    setBudgetEnabled(enabled);
    if (!enabled) {
      budgetInputRef.current?.blur();
      Keyboard.dismiss();
    }
  };

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      ANALYTICS_TAB_PRESS_EVENT,
      () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
    );

    return () => subscription.remove();
  }, []);

  const handleSaveBudget = async () => {
    const val = parseFloat(budgetLimitInput) || 0;
    await setSavedBudgetLimit(val);
    setBudgetLimitInput(val > 0 ? val.toString() : "");
    budgetInputRef.current?.blur();
    Keyboard.dismiss();
    setBudgetSaved(true);
    setTimeout(() => setBudgetSaved(false), 2000);
  };

  const handleToggle = (mode: "subscriptions" | "categories") => {
    setDonutMode(mode);
    Animated.spring(slideAnim, {
      toValue: mode === "subscriptions" ? 0 : 1,
      useNativeDriver: true,
      tension: 180,
      friction: 20,
    }).start();
  };

  // Per-subscription monthly amounts for donut
  const subSlices = [...activeWithMonthly]
    .sort((a, b) => b.monthlyConverted - a.monthlyConverted);

  const savingsTips: SavingsTip[] = [];

  // 1) Overlap in same category: suggest pausing one service
  const categoryGroups = activeWithMonthly.reduce(
    (acc, sub) => {
      if (!acc[sub.category]) acc[sub.category] = [];
      acc[sub.category].push(sub);
      return acc;
    },
    {} as Record<string, SubscriptionWithMonthly[]>,
  );
  const overlapEntry = Object.entries(categoryGroups)
    .filter(([, items]) => items.length >= 2)
    .sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      const totalA = a[1].reduce((sum, sub) => sum + sub.monthlyConverted, 0);
      const totalB = b[1].reduce((sum, sub) => sum + sub.monthlyConverted, 0);
      return totalB - totalA;
    })[0];
  if (overlapEntry) {
    const [category, items] = overlapEntry;
    const easiestToPause = [...items].sort((a, b) => a.monthlyConverted - b.monthlyConverted)[0];
    const yearlySavings = easiestToPause.monthlyConverted * 12;
    savingsTips.push({
      id: `overlap-${category}`,
      icon: "layers-outline",
      title: t("analytics.smart_tip_overlap_title"),
      description: t("analytics.smart_tip_overlap_desc", {
        category: t(`categories.${category}`),
        name: easiestToPause.name,
        savings: fmtDisplay(yearlySavings),
      }),
      monthlySavings: easiestToPause.monthlyConverted,
      yearlySavings,
    });
  }

  // 2) Heavy single subscription: a lower tier often saves ~20%
  const biggestSubscription = topExpensive[0];
  if (
    biggestSubscription &&
    monthly > 0 &&
    biggestSubscription.monthlyConverted / monthly >= 0.25
  ) {
    const yearlySavings = biggestSubscription.monthlyConverted * 12 * 0.2;
    savingsTips.push({
      id: `downgrade-${biggestSubscription.id}`,
      icon: "trending-down-outline",
      title: t("analytics.smart_tip_downgrade_title"),
      description: t("analytics.smart_tip_downgrade_desc", {
        name: biggestSubscription.name,
        savings: fmtDisplay(yearlySavings),
      }),
      monthlySavings: yearlySavings / 12,
      yearlySavings,
    });
  }

  // 3) Urgent renewal review in next 7 days
  const urgentRenewal = [...activeWithMonthly]
    .filter((s) => {
      const d = daysUntil(s.next_billing_date);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => b.monthlyConverted - a.monthlyConverted)[0];
  if (urgentRenewal) {
    const days = daysUntil(urgentRenewal.next_billing_date);
    const when =
      days === 0
        ? t("analytics.today")
        : days === 1
          ? t("analytics.tomorrow")
          : t("analytics.in_days", { count: days });
    const yearlySavings = urgentRenewal.monthlyConverted * 12;
    savingsTips.push({
      id: `renewal-${urgentRenewal.id}`,
      icon: "alert-circle-outline",
      title: t("analytics.smart_tip_renewal_title"),
      description: t("analytics.smart_tip_renewal_desc", {
        name: urgentRenewal.name,
        when,
        savings: fmtDisplay(yearlySavings),
      }),
      monthlySavings: urgentRenewal.monthlyConverted,
      yearlySavings,
    });
  }

  // 4) Aylık ödenen bir paketin yıllık hâli daha ucuzsa: gerçek tutarla "Yıllığa geç"
  const yearlySwitch = activeWithMonthly
    .filter(
      (s) =>
        s.billing_cycle === "monthly" &&
        !s.is_installment &&
        !s.duration_months &&
        (s.currency ?? "₺") === "₺",
    )
    .map((s) => ({ sub: s, alternative: findYearlyAlternative(s.name, s.amount) }))
    .filter((x) => x.alternative !== null)
    .sort((a, b) => b.alternative!.yearlySavings - a.alternative!.yearlySavings)[0];
  if (yearlySwitch?.alternative) {
    const { sub, alternative } = yearlySwitch;
    const yearlySavings = convert(alternative.yearlySavings, "₺");
    savingsTips.push({
      id: `yearly-${sub.id}`,
      icon: "calendar-outline",
      title: t("analytics.smart_tip_yearly_title"),
      description: t("analytics.smart_tip_yearly_desc", {
        name: sub.name,
        plan: alternative.plan.label,
        yearlyPrice: fmtDisplay(convert(parseFloat(alternative.plan.price), "₺")),
        savings: fmtDisplay(yearlySavings),
      }),
      monthlySavings: yearlySavings / 12,
      yearlySavings,
      action: {
        label: t("analytics.smart_tip_yearly_action"),
        onPress: () =>
          router.push({
            pathname: "/(app)/subscription/edit/[id]",
            params: { id: sub.id, cycle: "yearly", amount: alternative.plan.price },
          }),
      },
    });
  }

  // Veriden çıkan en güçlü ipucu (varsa 1 tane) + günlük değişen genel ipuçları; toplam 2
  const dataTips = savingsTips
    .filter((tip) => (tip.yearlySavings ?? 0) > 0)
    .sort((a, b) => (b.yearlySavings ?? 0) - (a.yearlySavings ?? 0))
    .slice(0, 1);
  const generalTips: SavingsTip[] = pickGeneralTips(
    activeSubs.map((s) => s.name),
    2 - dataTips.length,
  ).map((tip) => ({
    id: `general-${tip.id}`,
    icon: tip.icon,
    title: t(`analytics.general_tips.${tip.id}.title`),
    description: t(`analytics.general_tips.${tip.id}.desc`),
  }));
  const prioritizedTips = [...dataTips, ...generalTips];

  if (activeSubs.length === 0 && pausedSubs.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
          <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerBorder} />
          <View style={styles.headerContent}>
            <Text style={styles.title}>{t("analytics.title")}</Text>
            <TouchableOpacity
              onPress={() => router.push("/(app)/settings")}
              style={styles.settingsBtn}
            >
              <Ionicons name="settings-outline" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.outlineVariant} />
          <Text style={styles.emptyTitle}>{t("analytics.no_data")}</Text>
          <Text style={styles.emptyDesc}>{t("analytics.no_data_desc")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Frosted Glass Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t("analytics.title")}</Text>
          <TouchableOpacity
            onPress={() => router.push("/(app)/settings")}
            style={styles.settingsBtn}
          >
            <Ionicons name="settings-outline" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 64 }]}
      >
        {/* ═══ Overview Cards ═══ */}
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, { backgroundColor: colors.primarySolid }]}>
            <Text style={styles.overviewLabel}>{t("analytics.monthly_spending")}</Text>
            <Text style={styles.overviewAmount}>{fmtDisplay(monthly)}</Text>
            <Text style={styles.overviewSub}>
              {t("analytics.active_subs_count", { count: activeSubs.length })}
            </Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: colors.primarySolidContainer }]}>
            <Text style={styles.overviewLabel}>{t("analytics.yearly_projection")}</Text>
            <Text style={styles.overviewAmount}>{fmtDisplay(yearly)}</Text>
            <Text style={styles.overviewSub}>
              {fmtDisplay(daily)}{t("analytics.per_day")}
            </Text>
          </View>
        </View>

        <View style={styles.budgetCard}>
          <View
            style={[styles.budgetHeader, !budgetEnabled && styles.budgetHeaderCollapsed]}
          >
            <View style={styles.budgetTitleRow}>
              <View
                style={[
                  styles.budgetIcon,
                  {
                    backgroundColor: overBudget
                      ? colors.errorContainer + "55"
                      : colors.primary + "16",
                  },
                ]}
              >
                <Ionicons
                  name={overBudget ? "warning-outline" : "wallet-outline"}
                  size={18}
                  color={overBudget ? colors.error : colors.primary}
                />
              </View>
              <View style={styles.budgetTitleText}>
                <Text style={styles.budgetTitle}>{t("analytics.budget_limit")}</Text>
                <Text style={styles.budgetSubtitle}>
                  {!budgetEnabled
                    ? t("analytics.budget_disabled")
                    : budgetLimit > 0
                      ? overBudget
                        ? t("analytics.budget_over", {
                            amount: fmtDisplay(monthly - budgetLimit),
                          })
                        : t("analytics.budget_remaining", {
                            amount: fmtDisplay(budgetRemaining),
                          })
                      : t("analytics.budget_empty")}
                </Text>
              </View>
            </View>
            <Switch
              value={budgetEnabled}
              onValueChange={handleToggleBudget}
              trackColor={{
                false: colors.surfaceContainerHighest,
                true: colors.primary,
              }}
              thumbColor="#fff"
            />
          </View>

          {/* Kapalıyken limit saklanır ama çubuk ve alan gizlenir */}
          {budgetEnabled && budgetLimit > 0 && (
            <View style={styles.budgetProgressTrack}>
              <View
                style={[
                  styles.budgetProgressFill,
                  {
                    width: `${budgetUsagePct}%`,
                    backgroundColor: overBudget ? colors.error : colors.primary,
                  },
                ]}
              />
            </View>
          )}

          {budgetEnabled && (
            <View style={styles.budgetInputRow}>
              <TextInput
                inputAccessoryViewID={KEYBOARD_DONE_ID}
                ref={budgetInputRef}
                style={styles.budgetInput}
                value={budgetLimitInput}
                onChangeText={(value) => setBudgetLimitInput(sanitizeAmountInput(value))}
                placeholder={t("analytics.budget_placeholder")}
                placeholderTextColor={colors.outline}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSaveBudget}
              />
              <TouchableOpacity style={styles.budgetSaveBtn} onPress={handleSaveBudget}>
                <Text style={styles.budgetSaveBtnText}>
                  {budgetSaved ? t("analytics.budget_saved") : t("analytics.budget_save")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ═══ Donut Chart — Abonelik / Kategori ═══ */}
        {activeSubs.length > 0 && (() => {
          const DONUT_SIZE = 190;
          const STROKE = 30;
          const RADIUS = (DONUT_SIZE - STROKE) / 2;
          const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
          let accumulated = 0;

          const isSubs = donutMode === "subscriptions";

          // Slices: abonelik modunda subSlices, kategori modunda categoryTotals
          const slices: { key: string; color: string; pct: number; label: string; amount: number }[] =
            isSubs
              ? subSlices.map((s) => ({
                  key: s.id,
                  color: s.color,
                  pct: monthly > 0 ? s.monthlyConverted / monthly : 0,
                  label: s.name,
                  amount: s.monthlyConverted,
                }))
              : categoryTotals.map((c) => ({
                  key: c.category,
                  color: getCategoryColor(c.category, colors),
                  pct: monthly > 0 ? c.total / monthly : 0,
                  label: t(`categories.${c.category}`),
                  amount: c.total,
                }));

          return (
            <View style={styles.card}>
              {/* Başlık + toggle */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{t("analytics.distribution_title")}</Text>
                <View style={styles.toggleRow}>
                  {/* Kayan lacivert elips */}
                  {btnWidth > 0 && (
                    <Animated.View
                      style={[
                        styles.toggleSlider,
                        {
                          width: btnWidth,
                          transform: [{
                            translateX: slideAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, btnWidth + 2],
                            }),
                          }],
                        },
                      ]}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggle("subscriptions")}
                    onLayout={(e) => setBtnWidth(e.nativeEvent.layout.width)}
                  >
                    <Text style={[styles.toggleText, isSubs && styles.toggleTextActive]}>
                      {t("analytics.toggle_subs")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggle("categories")}
                  >
                    <Text style={[styles.toggleText, !isSubs && styles.toggleTextActive]}>
                      {t("analytics.toggle_cats")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Donut */}
              <View style={styles.donutContainer}>
                <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
                  <Circle
                    cx={DONUT_SIZE / 2}
                    cy={DONUT_SIZE / 2}
                    r={RADIUS}
                    stroke={colors.surfaceContainerHigh}
                    strokeWidth={STROKE}
                    fill="none"
                  />
                  <G rotation={-90} origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}>
                    {slices.map((slice) => {
                      const dash = slice.pct * CIRCUMFERENCE;
                      const gap = CIRCUMFERENCE - dash;
                      const offset = -accumulated * CIRCUMFERENCE;
                      accumulated += slice.pct;
                      return (
                        <Circle
                          key={slice.key}
                          cx={DONUT_SIZE / 2}
                          cy={DONUT_SIZE / 2}
                          r={RADIUS}
                          stroke={slice.color}
                          strokeWidth={STROKE}
                          strokeDasharray={`${dash} ${gap}`}
                          strokeDashoffset={offset}
                          strokeLinecap="butt"
                          fill="none"
                        />
                      );
                    })}
                  </G>
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutTotal}>{fmtDisplay(monthly)}</Text>
                  <Text style={styles.donutLabel}>{t("analytics.per_month_short")}</Text>
                </View>
              </View>

              {/* Legend */}
              <View style={styles.catList}>
                {slices.map((slice) => (
                  <View key={slice.key} style={styles.catRow}>
                    <View style={styles.catLeft}>
                      <View style={[styles.catDot, { backgroundColor: slice.color }]} />
                      <Text style={styles.catName} numberOfLines={1}>{slice.label}</Text>
                    </View>
                    <View style={styles.catRight}>
                      <Text style={styles.catAmount}>{fmtDisplay(slice.amount)}</Text>
                      <Text style={styles.catPct}>{(slice.pct * 100).toFixed(0)}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* ═══ Top Expenses ═══ */}
        {topExpensive.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("analytics.top_expenses")}</Text>
            {topExpensive.map((sub, index) => (
              <View key={sub.id} style={styles.expenseRow}>
                <Text style={styles.expenseRank}>#{index + 1}</Text>
                <SubscriptionIcon
                  value={sub.emoji}
                  bgColor={sub.color}
                  size={22}
                  containerSize={44}
                  radius={14}
                />
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseName}>{sub.name}</Text>
                  <Text style={styles.expenseMeta}>
                    {t(`categories.${sub.category}`)} · {t(`cycles.${sub.billing_cycle}`)}
                  </Text>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>
                    {fmtWithOriginal(sub.amount, sub.currency ?? "₺")}
                  </Text>
                  <Text style={styles.expenseMonthly}>
                    {fmtDisplay(sub.monthlyConverted)}{t("analytics.per_month_short")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ Upcoming Payments ═══ */}
        {upcoming.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("analytics.upcoming_payments")}</Text>
            {upcoming.map((sub) => {
              const days = daysUntil(sub.next_billing_date);
              const isUrgent = days <= 3;
              return (
                <View key={sub.id} style={styles.upcomingRow}>
                  <View
                    style={[
                      styles.upcomingBadge,
                      { backgroundColor: isUrgent ? colors.error + "18" : colors.primary + "12" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.upcomingDays,
                        { color: isUrgent ? colors.error : colors.primary },
                      ]}
                    >
                      {days === 0
                        ? t("analytics.today")
                        : days === 1
                          ? t("analytics.tomorrow")
                          : t("analytics.in_days", { count: days })}
                    </Text>
                  </View>
                  <SubscriptionIcon
                    value={sub.emoji}
                    bgColor={sub.color}
                    size={18}
                    containerSize={36}
                    radius={10}
                  />
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingName} numberOfLines={1}>{sub.name}</Text>
                  </View>
                  <Text style={styles.upcomingAmount} numberOfLines={1}>
                    {fmtWithOriginal(sub.amount, sub.currency ?? "₺")}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ═══ Billing Cycle Distribution ═══ */}
        {Object.keys(cycleCounts).length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("analytics.billing_cycles")}</Text>
            <View style={styles.cycleGrid}>
              {Object.entries(cycleCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([cycle, count]) => (
                  <View key={cycle} style={styles.cycleItem}>
                    <Text style={styles.cycleCount}>{count}</Text>
                    <Text style={styles.cycleLabel}>
                      {cycleLabels[cycle] ?? cycle}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* ═══ Tasarruf İpuçları (her zaman 2 ipucu) ═══ */}
        {prioritizedTips.length > 0 && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Ionicons name="bulb" size={20} color={colors.tertiary} />
              <Text style={styles.tipTitle}>{t("analytics.smart_savings_title")}</Text>
            </View>
            <View style={styles.tipList}>
              {prioritizedTips.map((tip, index) => (
                <View
                  key={tip.id}
                  style={[styles.tipItem, index < prioritizedTips.length - 1 && styles.tipItemBorder]}
                >
                  <View style={styles.tipItemTop}>
                    <View style={styles.tipIconWrap}>
                      <Ionicons name={tip.icon as any} size={18} color={colors.tertiary} />
                    </View>
                    <View style={styles.tipTextWrap}>
                      <Text style={styles.tipItemTitle}>{tip.title}</Text>
                      <Text style={styles.tipDesc}>{tip.description}</Text>
                    </View>
                  </View>
                  {tip.monthlySavings !== undefined && tip.yearlySavings !== undefined && (
                    <View style={styles.tipSavingsRow}>
                      <Text style={styles.tipSavingsMonthly}>
                        {t("analytics.tip_save_monthly", {
                          amount: fmtDisplay(tip.monthlySavings),
                        })}
                      </Text>
                      <Text style={styles.tipSavingsYearly}>
                        {t("analytics.tip_save_yearly", {
                          amount: fmtDisplay(tip.yearlySavings),
                        })}
                      </Text>
                    </View>
                  )}
                  {tip.action && (
                    <TouchableOpacity
                      style={styles.tipActionBtn}
                      onPress={tip.action.onPress}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.tipActionText}>{tip.action.label}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.onPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ═══ Summary Stats ═══ */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{subscriptions.length}</Text>
            <Text style={styles.statLabel}>{t("analytics.total_subs")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{activeSubs.length}</Text>
            <Text style={styles.statLabel}>{t("analytics.active")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{pausedSubs.length}</Text>
            <Text style={styles.statLabel}>{t("analytics.paused")}</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ---------- styles ----------

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: Spacing.xxl },

  // Header
  title: { ...Typography.headlineLg, color: colors.onSurface },
  headerWrapper: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: darkMode ? "rgba(16, 18, 22, 0.05)" : "rgba(255, 248, 255, 0.05)",
  },
  headerBorder: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: darkMode ? "rgba(242, 244, 251, 0.08)" : "rgba(25, 27, 34, 0.08)",
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

  // Overview cards
  overviewRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  overviewCard: {
    flex: 1,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xl,
  },
  overviewLabel: {
    ...Typography.labelSm,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  overviewAmount: {
    ...Typography.headlineLg,
    color: "#fff",
    fontWeight: "800",
  },
  overviewSub: {
    ...Typography.bodySm,
    color: "rgba(255,255,255,0.6)",
    marginTop: Spacing.xs,
  },

  // Budget
  budgetCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xl,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  // Kapalıyken kartta yalnızca başlık satırı kalır
  budgetHeaderCollapsed: {
    marginBottom: 0,
  },
  budgetTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  budgetTitleText: {
    flex: 1,
  },
  budgetIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  budgetTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: "800",
  },
  budgetSubtitle: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  budgetProgressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  budgetProgressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  budgetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    textAlign: "center",
    textAlignVertical: "center",
  },
  budgetSaveBtn: {
    backgroundColor: colors.primarySolid,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  budgetSaveBtnText: {
    ...Typography.labelLg,
    color: colors.onPrimary,
    fontWeight: "800",
  },

  // Generic card
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xl,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardTitle: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    marginBottom: Spacing.xl,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    padding: 3,
    gap: 2,
    position: "relative",
  },
  toggleSlider: {
    position: "absolute",
    top: 3,
    left: 3,
    bottom: 3,
    backgroundColor: colors.primarySolid,
    borderRadius: BorderRadius.full,
  },
  toggleBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    zIndex: 1,
  },
  toggleText: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  toggleTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  // Donut
  donutContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxl,
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
  },
  donutTotal: {
    ...Typography.headlineMd,
    color: colors.primary,
    fontWeight: "800",
  },
  donutLabel: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  catList: { gap: Spacing.md },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { ...Typography.bodyMd, color: colors.onSurface },
  catRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  catAmount: {
    ...Typography.labelMd,
    color: colors.onSurface,
    textAlign: "right",
  },
  catPct: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    width: 32,
    textAlign: "right",
  },

  // Top expenses
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  expenseRank: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    width: 20,
  },
  expenseInfo: { flex: 1 },
  expenseName: { ...Typography.labelLg, color: colors.onSurface },
  expenseMeta: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  expenseRight: { alignItems: "flex-end" },
  expenseAmount: {
    ...Typography.labelLg,
    color: colors.primary,
    fontWeight: "700",
  },
  expenseMonthly: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },

  // Upcoming
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  upcomingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 72,
    alignItems: "center",
  },
  upcomingDays: {
    ...Typography.labelSm,
    fontWeight: "700",
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingName: { ...Typography.labelMd, color: colors.onSurface },
  upcomingAmount: {
    ...Typography.labelMd,
    color: colors.primary,
    fontWeight: "700",
    flexShrink: 0,
  },

  // Billing cycles
  cycleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  cycleItem: {
    flex: 1,
    minWidth: "40%",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    alignItems: "center",
  },
  cycleCount: {
    ...Typography.headlineLg,
    color: colors.primary,
    fontWeight: "800",
  },
  cycleLabel: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.xs,
  },

  // Tip card
  tipCard: {
    backgroundColor: colors.tertiaryFixed + "1A",
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.tertiaryFixed + "33",
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tipTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: "700",
  },
  tipDesc: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    lineHeight: 22,
  },
  tipList: {
    gap: Spacing.md,
  },
  tipItem: {
    paddingBottom: Spacing.md,
  },
  tipItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.tertiaryFixed + "55",
  },
  tipItemTop: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  tipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.tertiaryFixed + "26",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tipTextWrap: {
    flex: 1,
    gap: 2,
  },
  tipItemTitle: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: "700",
  },
  tipActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: Spacing.md,
    marginLeft: 42,
    backgroundColor: colors.primarySolid,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
  },
  tipActionText: {
    ...Typography.labelMd,
    color: colors.onPrimary,
    fontWeight: "800",
  },
  tipSavingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    marginLeft: 42,
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  tipSavingsMonthly: {
    ...Typography.labelMd,
    color: colors.tertiary,
    fontWeight: "700",
  },
  tipSavingsYearly: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
  },

  // Summary stats
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    alignItems: "center",
  },
  statValue: {
    ...Typography.headlineLg,
    color: colors.primary,
    fontWeight: "800",
  },
  statLabel: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.xs,
    textAlign: "center",
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.headlineLg,
    color: colors.onSurface,
    marginTop: Spacing.xl,
  },
  emptyDesc: {
    ...Typography.bodyLg,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
