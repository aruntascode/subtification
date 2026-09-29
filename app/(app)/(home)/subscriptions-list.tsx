import SubscriptionIcon from "@/components/SubscriptionIcon";
import { CATEGORIES, Category } from "@/constants/categories";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useCurrency } from "@/hooks/useCurrency";
import {
  formatDurationProgress,
  getNextPaymentDate,
  isBilling,
} from "@/lib/subscriptionDuration";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type StatusFilter = "all" | "active" | "paused";

export default function SubscriptionsListStackScreen() {
  const {
    subscriptions,
    loading,
    fetchSubscriptions,
  } = useSubscriptionStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fmtDisplay, fmtWithOriginal, convert } = useCurrency();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");

  const onRefresh = useCallback(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const filtered = subscriptions.filter((sub) => {
    if (search && !sub.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (statusFilter === "active" && !isBilling(sub)) return false;
    if (statusFilter === "paused" && sub.is_active) return false;
    if (categoryFilter !== "all" && sub.category !== categoryFilter)
      return false;
    return true;
  });

  const filteredTotal = filtered
    .filter(isBilling)
    .reduce((sum, s) => sum + convert(s.amount, s.currency ?? "₺"), 0);

  const usedCategories = CATEGORIES.filter((cat) =>
    subscriptions.some((s) => s.category === cat.id),
  );

  const isChipActive = (type: "tumu" | "aktif" | "durakslatilmis" | string) => {
    if (type === "tumu")
      return statusFilter === "all" && categoryFilter === "all";
    if (type === "aktif") return statusFilter === "active";
    if (type === "durakslatilmis") return statusFilter === "paused";
    return categoryFilter === type;
  };

  return (
    <View style={styles.container}>
      {/* Frosted Glass Header — back button */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
          <Text style={styles.title}>{t("subscriptions.title")}</Text>
        </View>
      </View>

      <ScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
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
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("subscriptions.search_placeholder")}
            placeholderTextColor={colors.outline}
            value={search}
            onChangeText={setSearch}
          />
          {search !== "" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.outline} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersRow}
        >
          <TouchableOpacity
            style={[styles.chip, isChipActive("tumu") && styles.chipActive]}
            onPress={() => {
              setStatusFilter("all");
              setCategoryFilter("all");
            }}
          >
            <Text
              style={[
                styles.chipText,
                isChipActive("tumu") && styles.chipTextActive,
              ]}
            >
              {t("subscriptions.filter_all")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, isChipActive("aktif") && styles.chipActive]}
            onPress={() => {
              setStatusFilter("active");
              setCategoryFilter("all");
            }}
          >
            <Text
              style={[
                styles.chipText,
                isChipActive("aktif") && styles.chipTextActive,
              ]}
            >
              {t("subscriptions.filter_active")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.chip,
              isChipActive("durakslatilmis") && styles.chipActive,
            ]}
            onPress={() => {
              setStatusFilter("paused");
              setCategoryFilter("all");
            }}
          >
            <Text
              style={[
                styles.chipText,
                isChipActive("durakslatilmis") && styles.chipTextActive,
              ]}
            >
              {t("subscriptions.filter_paused")}
            </Text>
          </TouchableOpacity>

          {usedCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.chip,
                isChipActive(cat.id) && { backgroundColor: cat.color },
              ]}
              onPress={() => {
                setCategoryFilter(cat.id);
                setStatusFilter("all");
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  isChipActive(cat.id) && styles.chipTextActive,
                ]}
              >
                {t(`categories.${cat.id}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {t("subscriptions.summary", {
              count: filtered.length,
              total: fmtDisplay(filteredTotal),
            })}
          </Text>
        </View>

        {/* Cards */}
        {filtered.map((sub) => {
          const nextPayment = getNextPaymentDate(sub);
          const nextBillDate = nextPayment
            ? nextPayment.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : t("duration.finished");
          const durationProgress = formatDurationProgress(sub, t);
          const categoryLabel = t(`categories.${sub.category}`);
          const cycleLabel =
            t(`common.${sub.billing_cycle}`) || sub.billing_cycle;

          return (
            <TouchableOpacity
              key={sub.id}
              style={styles.subCard}
              onPress={() => router.push(`/(app)/subscription/${sub.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTopRow}>
                <SubscriptionIcon
                  value={sub.emoji}
                  bgColor={sub.color}
                  size={28}
                  containerSize={56}
                  radius={16}
                />
                <View style={styles.statusBlock}>
                  <Text style={styles.statusLabel}>{t("subscriptions.status").toLocaleUpperCase(i18n.language)}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      sub.is_active
                        ? styles.statusBadgeActive
                        : styles.statusBadgePaused,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        sub.is_active
                          ? styles.statusBadgeTextActive
                          : styles.statusBadgeTextPaused,
                      ]}
                    >
                      {sub.is_active
                        ? t("subscriptions.filter_active").toUpperCase()
                        : t("subscriptions.filter_paused").toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardName}>{sub.name}</Text>
              <Text style={styles.cardMeta}>
                {categoryLabel} • {cycleLabel}
                {durationProgress ? ` • ${durationProgress}` : ""}
              </Text>

              <View style={styles.cardDivider} />

              <View style={styles.cardBottomRow}>
                <View>
                  <Text style={styles.cardBottomLabel}>
                    {sub.billing_cycle === "yearly"
                      ? t("subscription_detail.yearly_cost")
                      : t("subscription_detail.monthly_cost")}
                  </Text>
                  <Text
                    style={[
                      styles.cardPrice,
                      !sub.is_active && styles.cardPricePaused,
                    ]}
                  >
                    {fmtWithOriginal(sub.amount, sub.currency ?? "₺")}
                  </Text>
                </View>
                <View style={styles.cardNextBillBlock}>
                  <Text style={styles.cardBottomLabel}>
                    {t("subscription_detail.next_billing")}
                  </Text>
                  <Text style={styles.cardNextBillDate}>{nextBillDate}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Empty state */}
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={48}
              color={colors.outlineVariant}
            />
            <Text style={styles.emptyText}>
              {subscriptions.length === 0
                ? t("subscriptions.no_subs")
                : t("subscriptions.no_results")}
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: Spacing.xxl },

  // ── Frosted Glass Header ──
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
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
  backBtn: { padding: 4 },
  title: {
    ...Typography.headlineLg,
    color: colors.onSurface,
    fontWeight: "800",
    flex: 1,
  },

  // ── Filters ──
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, ...Typography.bodyLg, color: colors.onSurface },
  filtersRow: { marginBottom: Spacing.md, flexGrow: 0 },
  chip: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  chipActive: { backgroundColor: colors.primarySolid },
  chipText: { ...Typography.labelMd, color: colors.onSurfaceVariant },
  chipTextActive: { color: "#ffffff" },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  summaryText: { ...Typography.bodyMd, color: colors.onSurfaceVariant },

  // ── Cards ──
  subCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  statusBlock: { alignItems: "flex-end", gap: Spacing.xs },
  statusLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  statusBadgeActive: { backgroundColor: darkMode ? colors.tertiaryFixed + "66" : "#d4f5e2" },
  statusBadgePaused: { backgroundColor: colors.surfaceContainerHigh },
  statusBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  statusBadgeTextActive: { color: darkMode ? colors.tertiaryFixedDim : "#1a7a45" },
  statusBadgeTextPaused: { color: colors.onSurfaceVariant },
  cardName: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMeta: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginVertical: Spacing.lg,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardBottomLabel: { fontSize: 11, color: colors.onSurfaceVariant, marginBottom: 4 },
  cardPrice: { ...Typography.headlineMd, color: colors.primary, fontWeight: "800" },
  cardPricePaused: { color: colors.outline },
  cardNextBillBlock: { alignItems: "flex-end" },
  cardNextBillDate: { ...Typography.labelLg, color: colors.onSurface, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.huge },
  emptyText: {
    ...Typography.bodyLg,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.md,
    textAlign: "center",
  },
});
