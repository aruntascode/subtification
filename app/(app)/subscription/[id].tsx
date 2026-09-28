import SubscriptionIcon from "@/components/SubscriptionIcon";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useCurrency } from "@/hooks/useCurrency";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTabBar } from "@/components/AppTabBar";
import { isLightColor } from "@/lib/colorContrast";
import {
  getLastPaymentDate,
  getNextPaymentDate,
  getPaidCount,
  isFinished,
  toDateOnly,
} from "@/lib/subscriptionDuration";

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    subscriptions,
    deleteSubscription,
    toggleActive,
  } = useSubscriptionStore();

  const subscription = subscriptions.find((s) => s.id === id);
  const { fmtWithOriginal } = useCurrency();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  if (!subscription) {
    return (
      <View style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Subscription not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const finished = isFinished(subscription);
  const nextPaymentDate = getNextPaymentDate(subscription);
  const lastPaymentDate = getLastPaymentDate(subscription);
  const paidCount = getPaidCount(subscription);
  const totalMonths = subscription.duration_months ?? 0;
  const remainingMonths = totalMonths - paidCount;

  const getDaysUntil = () => {
    if (!nextPaymentDate) return 0;
    const diff = nextPaymentDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const categoryLabel = t(`categories.${subscription.category}`);
  const daysUntil = getDaysUntil();

  const handleToggle = async () => {
    try {
      await toggleActive(subscription.id);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t("subscription_detail.delete_confirm_title"),
      t("subscription_detail.delete_confirm_message"),
      [
        { text: t("subscription_detail.delete_cancel"), style: "cancel" },
        {
          text: t("subscription_detail.delete_confirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSubscription(subscription.id);
              router.back();
            } catch (error: any) {
              Alert.alert(t("common.error"), error.message);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const cycleLabel = (c: string) => {
    switch (c) {
      case "monthly":
        return t("common.monthly");
      case "yearly":
        return t("common.yearly");
      case "weekly":
        return t("common.weekly");
      case "quarterly":
        return t("common.quarterly");
      default:
        return "";
    }
  };

  return (
    <View style={styles.container}>
      {/* ── DETAIL VIEW (always rendered behind) ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 64 },
        ]}
      >
        {/* Hero */}
        <View style={styles.heroCenter}>
          <SubscriptionIcon
            value={subscription.emoji}
            bgColor={subscription.color}
            size={48}
            containerSize={96}
            radius={28}
          />
          <Text style={styles.heroNameCenter}>{subscription.name}</Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroCategoryBadge}>
              <Text style={styles.heroCategoryText}>
                {categoryLabel.toUpperCase()}
              </Text>
            </View>
            {subscription.is_installment && (
              <View style={styles.heroCategoryBadge}>
                <Text style={styles.heroCategoryText}>
                  {t("duration.installment_badge").toLocaleUpperCase(i18n.language)}
                </Text>
              </View>
            )}
            {finished && (
              <View style={[styles.heroCategoryBadge, styles.finishedBadge]}>
                <Text style={[styles.heroCategoryText, styles.finishedBadgeText]}>
                  {t("duration.finished").toLocaleUpperCase(i18n.language)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bento cards */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoCardLight}>
            <Text style={styles.bentoLabel}>
              {subscription.billing_cycle === "yearly"
                      ? t("subscription_detail.yearly_cost")
                      : t("subscription_detail.monthly_cost")}
            </Text>
            <View style={styles.bentoAmountRow}>
              <Text
                style={styles.bentoAmount}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {fmtWithOriginal(subscription.amount, subscription.currency ?? "₺")}
              </Text>
              <Text style={styles.bentoCycle}>
                / {cycleLabel(subscription.billing_cycle)}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                subscription.is_active ? styles.activeBadge : styles.pausedBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  subscription.is_active
                    ? styles.activeBadgeText
                    : styles.pausedBadgeText,
                ]}
              >
                {subscription.is_active
                  ? t("subscriptions.filter_active")
                  : t("subscriptions.filter_paused")}
              </Text>
            </View>
          </View>

          <View style={styles.bentoCardDark}>
            <Ionicons
              name="calendar"
              size={24}
              color={colors.onPrimaryContainer}
              style={{ marginBottom: Spacing.sm }}
            />
            <Text style={styles.bentoLabelDark}>
              {t("subscription_detail.next_billing")}
            </Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.bentoDateValue}>
                {nextPaymentDate
                  ? formatDate(
                      subscription.duration_months
                        ? toDateOnly(nextPaymentDate)
                        : subscription.next_billing_date,
                    )
                  : t("duration.finished")}
              </Text>
            </View>
            {nextPaymentDate && (
              <Text style={styles.bentoDaysSub}>
                {t("subscription_detail.days_left", { days: daysUntil })}
              </Text>
            )}
          </View>
        </View>

        {totalMonths > 0 && lastPaymentDate && (
          <View style={styles.notesCard}>
            <Text style={styles.notesSectionTitle}>
              {t("duration.remaining_title")}
            </Text>
            <Text style={styles.durationValue}>
              {subscription.is_installment
                ? t("duration.progress_installment", {
                    paid: paidCount,
                    total: totalMonths,
                  })
                : t("duration.remaining_value", {
                    remaining: remainingMonths,
                    total: totalMonths,
                  })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round((paidCount / totalMonths) * 100)}%`,
                    backgroundColor: isLightColor(subscription.color)
                      ? colors.outline
                      : subscription.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.durationMeta}>
              {t("duration.last_payment", {
                date: lastPaymentDate.toLocaleDateString(i18n.language, {
                  month: "long",
                  year: "numeric",
                }),
              })}
            </Text>
            {remainingMonths > 0 && (
              <Text style={styles.durationMeta}>
                {t("duration.remaining_total", {
                  amount: fmtWithOriginal(
                    subscription.amount * remainingMonths,
                    subscription.currency ?? "₺",
                  ),
                })}
              </Text>
            )}
          </View>
        )}

        {subscription.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesSectionTitle}>
              {t("subscription_detail.notes")}
            </Text>
            <Text style={styles.notesText}>{subscription.notes}</Text>
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleToggle}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>
                {subscription.is_active
                  ? t("subscription_detail.pause")
                  : t("subscription_detail.resume")}
              </Text>
            </View>
            <View style={styles.actionIconBg}>
              <Ionicons
                name={subscription.is_active ? "pause" : "play"}
                size={20}
                color={colors.onSurface}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.6}
          >
            <Ionicons name="trash-outline" size={20} color={colors.onError} />
            <Text style={styles.deleteButtonText}>
              {t("subscription_detail.delete")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Tab Bar ── */}
      <AppTabBar />

      {/* ── Detail view header ── */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Abonelik Detayı</Text>
          <TouchableOpacity
            onPress={() => router.push(`/(app)/subscription/edit/${subscription.id}`)}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.editBtnText}>{t("subscription_detail.edit")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

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
  headerTitle: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    flex: 1,
    fontWeight: "800",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  editBtnText: { ...Typography.labelMd, color: colors.primary },

  // ── Detail ScrollView ──
  scrollContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },

  // ── Hero ──
  heroCenter: {
    alignItems: "center",
    marginBottom: Spacing.xxxl,
    marginTop: Spacing.lg,
  },
  heroNameCenter: {
    ...Typography.displayMd,
    color: colors.onSurface,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  finishedBadge: {
    backgroundColor: colors.primaryFixed,
  },
  finishedBadgeText: {
    color: colors.primary,
  },
  durationValue: {
    ...Typography.headlineMd,
    color: colors.onSurface,
    marginBottom: Spacing.md,
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  durationMeta: {
    ...Typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  heroCategoryBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  heroCategoryText: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    letterSpacing: 1.5,
  },

  // ── Bento Cards ──
  bentoGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
    alignItems: "stretch",
  },
  bentoCardLight: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xl,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    justifyContent: "space-between",
  },
  bentoLabel: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.sm,
  },
  bentoAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.lg,
    flexWrap: "nowrap",
  },
  bentoAmount: {
    ...Typography.displayLg,
    color: colors.primary,
    flexShrink: 1,
  },
  bentoCycle: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    marginLeft: 4,
    flexShrink: 0,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  activeBadge: { backgroundColor: colors.tertiaryFixed },
  pausedBadge: { backgroundColor: colors.surfaceContainerHigh },
  statusBadgeText: { ...Typography.labelSm },
  activeBadgeText: { color: colors.tertiary },
  pausedBadgeText: { color: colors.onSurfaceVariant },
  bentoCardDark: {
    flex: 1,
    backgroundColor: colors.primaryContainer,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xl,
    justifyContent: "space-between",
  },
  bentoLabelDark: {
    ...Typography.labelSm,
    color: colors.onPrimaryContainer + "99",
  },
  bentoDateValue: {
    ...Typography.headlineLg,
    color: colors.onPrimaryContainer,
    fontWeight: "800",
  },
  bentoDaysSub: {
    ...Typography.labelMd,
    color: colors.onPrimaryContainer + "CC",
  },

  // ── Notes & Actions ──
  notesCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    marginBottom: Spacing.xxl,
  },
  notesSectionTitle: {
    ...Typography.headlineSm,
    color: colors.onSurface,
    marginBottom: Spacing.md,
  },
  notesText: {
    ...Typography.bodyLg,
    color: colors.onSurfaceVariant,
    lineHeight: 24,
  },
  actionGrid: { gap: Spacing.md },
  actionCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
  },
  actionTitle: { ...Typography.headlineSm, color: colors.onSurface },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: darkMode ? colors.surfaceContainerHighest : "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.xxl,
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    ...Typography.labelLg,
    color: colors.onError,
    fontWeight: "700",
  },


  // ── Not Found ──
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: {
    ...Typography.headlineMd,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.md,
  },
  backLink: { ...Typography.labelLg, color: colors.primary },
});
