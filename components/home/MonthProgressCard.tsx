import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { startOfToday, type ScheduledPayment } from "@/lib/paymentSchedule";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  /** Bu ayın tüm ödemeleri (getPaymentsInMonth) */
  payments: ScheduledPayment[];
};

/** "Bu ay ödenen / kalan" özeti: maaş dönemini planlamak için */
export default function MonthProgressCard({ payments }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { convert, fmtDisplay } = useCurrency();

  const today = startOfToday();
  let paid = 0;
  let remaining = 0;
  let remainingCount = 0;
  for (const { sub, date } of payments) {
    const amount = convert(sub.amount, sub.currency ?? "₺");
    // Bugünkü ödeme henüz çekilmemiş sayılır
    if (date < today) {
      paid += amount;
    } else {
      remaining += amount;
      remainingCount++;
    }
  }
  const total = paid + remaining;
  const paidRatio = total > 0 ? paid / total : 0;

  const monthName = today.toLocaleDateString(i18n.language, { month: "long" });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {t("home_month.title", { month: monthName })}
        </Text>
        <Text style={styles.meta}>
          {remainingCount > 0
            ? t("home_month.payments_left", { count: remainingCount })
            : t("home_month.all_paid")}
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(paidRatio * 100)}%` }]} />
      </View>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>{t("home_month.paid")}</Text>
          <Text style={styles.amountPaid}>{fmtDisplay(paid)}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={styles.amountLabel}>{t("home_month.remaining")}</Text>
          <Text style={styles.amountRemaining}>{fmtDisplay(remaining)}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
    },
    meta: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
    },
    track: {
      height: 8,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceContainerHighest,
      overflow: "hidden",
      marginBottom: Spacing.md,
    },
    fill: {
      height: "100%",
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primary,
    },
    amountRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    alignEnd: {
      alignItems: "flex-end",
    },
    amountLabel: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
      marginBottom: 2,
    },
    amountPaid: {
      ...Typography.headlineSm,
      color: colors.primary,
      fontWeight: "800",
    },
    amountRemaining: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: "800",
    },
  });
