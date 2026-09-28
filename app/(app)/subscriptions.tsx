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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  DeviceEventEmitter,
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
const SUBSCRIPTIONS_TAB_PRESS_EVENT = "subscriptionsTabPress";

// ── Main Screen ───────────────────────────────────────────────
export default function SubscriptionsListScreen() {
  const {
    subscriptions,
    loading,
    fetchSubscriptions,
    setActiveMany,
    deleteMany,
  } = useSubscriptionStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fmtDisplay, fmtWithOriginal, convert } = useCurrency();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");

  const onRefresh = useCallback(() => {
    fetchSubscriptions();
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      SUBSCRIPTIONS_TAB_PRESS_EVENT,
      () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      },
    );

    return () => subscription.remove();
  }, []);

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

  // Only show category chips that have at least 1 subscription
  const usedCategories = CATEGORIES.filter((cat) =>
    subscriptions.some((s) => s.category === cat.id),
  );

  // ── Toplu seçim ──
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Filtre değişince görünmeyen seçimler işleme dahil edilmesin
  const visibleSelectedIds = selectedIds.filter((id) =>
    filtered.some((s) => s.id === id),
  );
  const selectedSubs = filtered.filter((s) => visibleSelectedIds.includes(s.id));
  // Seçilenlerin hepsi duraklatılmışsa buton "Devam ettir" olur
  const allSelectedPaused =
    selectedSubs.length > 0 && selectedSubs.every((s) => !s.is_active);
  const allVisibleSelected =
    filtered.length > 0 && visibleSelectedIds.length === filtered.length;

  const exitSelecting = () => {
    setSelecting(false);
    setSelectedIds([]);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : filtered.map((s) => s.id));
  };

  const handleBulkPause = async () => {
    try {
      await setActiveMany(visibleSelectedIds, allSelectedPaused);
      exitSelecting();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const handleBulkDelete = () => {
    const count = visibleSelectedIds.length;
    Alert.alert(
      t("subscriptions.bulk_delete_title", { count }),
      t("subscriptions.bulk_delete_message"),
      [
        { text: t("subscriptions.delete_cancel"), style: "cancel" },
        {
          text: t("subscriptions.delete_confirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMany(visibleSelectedIds);
              exitSelecting();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ],
    );
  };

  const isChipActive = (type: "tumu" | "aktif" | "durakslatilmis" | string) => {
    if (type === "tumu")
      return statusFilter === "all" && categoryFilter === "all";
    if (type === "aktif") return statusFilter === "active";
    if (type === "durakslatilmis") return statusFilter === "paused";
    return categoryFilter === type;
  };

  return (
    <View style={styles.container}>
      {/* Frosted Glass Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t("subscriptions.title")}</Text>
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

      <ScrollView
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 64 }]}
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

        {/* Merged single chip row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersRow}
        >
          {/* Tümü */}
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

          {/* Aktif */}
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

          {/* Duraklatılmış */}
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

          {/* Per-category chips (only used ones) */}
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
          {selecting ? (
            <TouchableOpacity onPress={handleToggleSelectAll} hitSlop={8}>
              <Text style={styles.summaryLink}>
                {allVisibleSelected
                  ? t("subscriptions.deselect_all")
                  : t("subscriptions.select_all")}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.summaryText}>
              {t("subscriptions.summary", {
                count: filtered.length,
                total: fmtDisplay(filteredTotal),
              })}
            </Text>
          )}
          {/* Seçim karta uzun basınca başlar; buton yalnızca modu kapatmak için */}
          {selecting && (
            <TouchableOpacity
              onPress={exitSelecting}
              style={[styles.selectBtn, styles.selectBtnActive]}
              hitSlop={8}
            >
              <Text style={[styles.selectBtnText, styles.selectBtnTextActive]}>
                {t("subscriptions.select_done")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Subscription Cards */}
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
          const cycleLabel = t(`common.${sub.billing_cycle}`) || sub.billing_cycle;
          const isSelected = selecting && visibleSelectedIds.includes(sub.id);

          return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subCard, isSelected && styles.subCardSelected]}
                onPress={() =>
                  selecting
                    ? toggleSelected(sub.id)
                    : router.push(`/(app)/subscription/${sub.id}`)
                }
                // Uzun basınca seçim modu başlasın (iOS listelerindeki gibi)
                onLongPress={() => {
                  if (selecting) return;
                  setSelecting(true);
                  setSelectedIds([sub.id]);
                }}
                activeOpacity={0.85}
              >
                {/* ── Top Row: icon + status badge ── */}
                <View style={styles.cardTopRow}>
                  <SubscriptionIcon
                    value={sub.emoji}
                    bgColor={sub.color}
                    size={28}
                    containerSize={56}
                    radius={16}
                  />
                  {selecting ? (
                    <Ionicons
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                      size={28}
                      color={isSelected ? colors.primary : colors.outline}
                    />
                  ) : (
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
                  )}
                </View>

                {/* ── Name + subtitle ── */}
                <Text style={styles.cardName}>{sub.name}</Text>
                <Text style={styles.cardMeta}>
                  {categoryLabel} • {cycleLabel}
                  {durationProgress ? ` • ${durationProgress}` : ""}
                </Text>

                {/* ── Divider ── */}
                <View style={styles.cardDivider} />

                {/* ── Bottom Row: price + next bill ── */}
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

        {/* Seçim çubuğu listenin son kartını örtmesin */}
        <View style={{ height: selecting ? 180 : 100 }} />
      </ScrollView>

      {/* ── Toplu işlem çubuğu (sekme çubuğunun hemen üstünde) ── */}
      {selecting && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>
            {t("subscriptions.selected_count", { count: visibleSelectedIds.length })}
          </Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[
                styles.bulkBtn,
                visibleSelectedIds.length === 0 && styles.bulkBtnDisabled,
              ]}
              onPress={handleBulkPause}
              disabled={visibleSelectedIds.length === 0 || loading}
              activeOpacity={0.8}
            >
              <Ionicons
                name={allSelectedPaused ? "play" : "pause"}
                size={16}
                color={colors.onSurface}
              />
              <Text style={styles.bulkBtnText}>
                {allSelectedPaused
                  ? t("subscription_detail.resume")
                  : t("subscription_detail.pause")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.bulkBtn,
                styles.bulkBtnDanger,
                visibleSelectedIds.length === 0 && styles.bulkBtnDisabled,
              ]}
              onPress={handleBulkDelete}
              disabled={visibleSelectedIds.length === 0 || loading}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color={colors.onError} />
              <Text style={[styles.bulkBtnText, { color: colors.onError }]}>
                {t("subscription_detail.delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingHorizontal: Spacing.xxl },
  title: { ...Typography.headlineLg, color: colors.onSurface },
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
  summaryText: { ...Typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  summaryLink: { ...Typography.labelLg, color: colors.primary, fontWeight: "700" },
  selectBtn: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    marginLeft: Spacing.md,
  },
  selectBtnActive: { backgroundColor: colors.primarySolid },
  selectBtnText: { ...Typography.labelMd, color: colors.primary, fontWeight: "700" },
  selectBtnTextActive: { color: "#ffffff" },
  subCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    padding: Spacing.xl - 2,
  },
  // Sekme çubuğunun dokunma alanı ~91px; onun üstünde yüzen çubuk
  bulkBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 104,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 20,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 150,
  },
  bulkCount: { ...Typography.labelLg, color: colors.onSurface, fontWeight: "800" },
  bulkActions: { flexDirection: "row", gap: Spacing.sm },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  bulkBtnDanger: { backgroundColor: colors.error },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnText: { ...Typography.labelMd, color: colors.onSurface, fontWeight: "800" },
  summaryAmount: { ...Typography.labelLg, color: colors.primary },
  // ── New Card Styles ──
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
  statusBlock: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
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
  statusBadgeActive: {
    backgroundColor: darkMode ? colors.tertiaryFixed + "66" : "#d4f5e2",
  },
  statusBadgePaused: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statusBadgeTextActive: {
    color: darkMode ? colors.tertiaryFixedDim : "#1a7a45",
  },
  statusBadgeTextPaused: {
    color: colors.onSurfaceVariant,
  },
  cardName: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMeta: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
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
  cardBottomLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  cardPrice: {
    ...Typography.headlineMd,
    color: colors.primary,
    fontWeight: "800",
  },
  cardPricePaused: {
    color: colors.outline,
  },
  cardNextBillBlock: {
    alignItems: "flex-end",
  },
  cardNextBillDate: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: "700",
  },
  emptyState: { alignItems: "center", paddingVertical: Spacing.huge },
  emptyText: {
    ...Typography.bodyLg,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.md,
    textAlign: "center",
  },
});
