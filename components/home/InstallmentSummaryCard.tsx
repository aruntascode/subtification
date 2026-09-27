import SubscriptionIcon from "@/components/SubscriptionIcon";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { isLightColor } from "@/lib/colorContrast";
import {
  getPaidCount,
  getRemainingCount,
  isBilling,
} from "@/lib/subscriptionDuration";
import type { Subscription } from "@/stores/subscriptionStore";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const MAX_ROWS = 3;

type Props = {
  subscriptions: Subscription[];
  onPressSubscription: (id: string) => void;
};

/** Aktif taksitlerin özeti; bitmek üzere olan taksit "bütçen rahatlıyor" haberi verir */
export default function InstallmentSummaryCard({
  subscriptions,
  onPressSubscription,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { convert, fmtDisplay, fmtWithOriginal } = useCurrency();

  const installments = subscriptions
    .filter((s) => s.is_installment && s.duration_months && isBilling(s))
    .map((sub) => ({
      sub,
      paid: getPaidCount(sub),
      remaining: getRemainingCount(sub) ?? 0,
      total: sub.duration_months ?? 0,
    }))
    .sort((a, b) => a.remaining - b.remaining);

  if (installments.length === 0) return null;

  const monthlyTotal = installments.reduce(
    (sum, { sub }) => sum + convert(sub.amount, sub.currency ?? "₺"),
    0,
  );
  const hiddenCount = installments.length - MAX_ROWS;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("home_installments.title")}</Text>
        <Text style={styles.headerMeta}>
          {t("home_installments.monthly_total", { amount: fmtDisplay(monthlyTotal) })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.summary}>
          {t("home_installments.summary", {
            count: installments.length,
            name: installments[0].sub.name,
            remaining: installments[0].remaining,
          })}
        </Text>

        {installments.slice(0, MAX_ROWS).map(({ sub, paid, total }) => (
          <TouchableOpacity
            key={sub.id}
            style={styles.row}
            onPress={() => onPressSubscription(sub.id)}
            activeOpacity={0.75}
          >
            <SubscriptionIcon
              value={sub.emoji}
              bgColor={sub.color}
              size={18}
              containerSize={36}
              radius={10}
            />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {sub.name}
                </Text>
                <Text style={styles.rowAmount}>
                  {fmtWithOriginal(sub.amount, sub.currency ?? "₺")}
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round((paid / total) * 100)}%`,
                      backgroundColor: isLightColor(sub.color)
                        ? colors.outline
                        : sub.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.rowMeta}>
                {t("duration.progress_installment", { paid, total })}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {hiddenCount > 0 && (
          <Text style={styles.more}>
            {t("home_installments.more", { count: hiddenCount })}
          </Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    section: {
      marginBottom: Spacing.xxxl,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      fontWeight: "800",
    },
    headerMeta: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: "700",
    },
    card: {
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: Spacing.lg,
      gap: Spacing.lg,
      shadowColor: colors.onSurface,
      shadowOpacity: 0.04,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    summary: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    rowBody: {
      flex: 1,
    },
    rowTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: 6,
    },
    rowName: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "700",
      flex: 1,
    },
    rowAmount: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: "800",
    },
    track: {
      height: 6,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: BorderRadius.full,
    },
    rowMeta: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 4,
    },
    more: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      textAlign: "center",
    },
  });
