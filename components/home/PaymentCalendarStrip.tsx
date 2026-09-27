import SubscriptionIcon from "@/components/SubscriptionIcon";
import type { AppColors } from "@/constants/colors";
import { Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useCurrency } from "@/hooks/useCurrency";
import { isLightColor } from "@/lib/colorContrast";
import {
  isSameDay,
  startOfToday,
  type ScheduledPayment,
} from "@/lib/paymentSchedule";
import { parseDateOnly, toDateOnly } from "@/lib/subscriptionDuration";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CELL_WIDTH = 48;
const CELL_GAP = 8;
const MAX_DOTS = 3;

/** Sonraki aydan kaç gün gösterileceği */
export const CALENDAR_NEXT_MONTH_DAYS = 15;

type Props = {
  /**
   * Bu ayın tüm ödemeleri + sonraki ayın ilk CALENDAR_NEXT_MONTH_DAYS gününün
   * ödemeleri (getPaymentsInMonth ile iki ay)
   */
  payments: ScheduledPayment[];
  onPressSubscription: (id: string) => void;
};

/**
 * Bu ayın başından sonraki ayın 15'ine kadar günleri gösteren yatay şerit;
 * hangi hafta yoğun bir bakışta görünür. Ay değişince önceki ay düşer.
 */
export default function PaymentCalendarStrip({ payments, onPressSubscription }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { fmtWithOriginal } = useCurrency();

  const today = startOfToday();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1 Eylül … 30 Eylül, 1 Ekim … 15 Ekim
  const days = Array.from(
    { length: daysInMonth + CALENDAR_NEXT_MONTH_DAYS },
    (_, i) => new Date(year, month, i + 1),
  );

  // Açılışta bugünü, bugün ödeme yoksa sıradaki ödeme gününü seç
  const [selectedKey, setSelectedKey] = useState(() => {
    const todayHasPayment = payments.some((p) => isSameDay(p.date, today));
    if (todayHasPayment) return toDateOnly(today);
    const next = payments.find((p) => p.date > today);
    return toDateOnly(next ? next.date : today);
  });

  const paymentsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPayment[]>();
    for (const payment of payments) {
      const key = toDateOnly(payment.date);
      map.set(key, [...(map.get(key) ?? []), payment]);
    }
    return map;
  }, [payments]);

  const selectedPayments = paymentsByDay.get(selectedKey) ?? [];
  const selectedDate = parseDateOnly(selectedKey);
  const lastDay = days[days.length - 1];
  // "Eylül – 15 Ekim 2026"
  const rangeLabel = `${today.toLocaleDateString(i18n.language, {
    month: "long",
  })} – ${lastDay.toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
  // Bugünü sola yakın göstermek için başlangıç kaydırması (2 gün öncesi görünsün)
  const initialOffset = Math.max(0, (today.getDate() - 3) * (CELL_WIDTH + CELL_GAP));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("home_calendar.title")}</Text>
        <Text style={styles.monthLabel}>{rangeLabel}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        contentOffset={{ x: initialOffset, y: 0 }}
      >
        {days.map((date) => {
          const key = toDateOnly(date);
          const dayPayments = paymentsByDay.get(key) ?? [];
          const isSelected = key === selectedKey;
          const isToday = isSameDay(date, today);
          const isPast = date < today;
          // Sonraki ayın 1'inde gün adı yerine ay adı: şeritte ay geçişi belli olsun
          const isMonthStart = date.getDate() === 1 && date.getMonth() !== month;
          const topLabel = date
            .toLocaleDateString(
              i18n.language,
              isMonthStart ? { month: "short" } : { weekday: "short" },
            )
            .replace(".", "");

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.cell,
                isMonthStart && styles.cellMonthStart,
                isToday && styles.cellToday,
                isSelected && styles.cellSelected,
              ]}
              onPress={() => setSelectedKey(key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.weekday,
                  isMonthStart && styles.monthStartLabel,
                  isPast && styles.textPast,
                  isSelected && styles.textSelected,
                ]}
              >
                {topLabel}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isPast && styles.textPast,
                  isSelected && styles.textSelected,
                ]}
              >
                {date.getDate()}
              </Text>
              <View style={styles.dotRow}>
                {dayPayments.slice(0, MAX_DOTS).map(({ sub }) => (
                  <View
                    key={sub.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected
                          ? "#ffffff"
                          : isLightColor(sub.color)
                            ? colors.outline
                            : sub.color,
                      },
                    ]}
                  />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.dayList}>
        <Text style={styles.dayListTitle}>
          {selectedDate.toLocaleDateString(i18n.language, {
            day: "numeric",
            month: "long",
            weekday: "long",
          })}
        </Text>
        {selectedPayments.length === 0 ? (
          <Text style={styles.emptyText}>{t("home_calendar.no_payments")}</Text>
        ) : (
          selectedPayments.map(({ sub, date }) => (
            <TouchableOpacity
              key={sub.id}
              style={styles.paymentRow}
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
              <Text style={styles.paymentName} numberOfLines={1}>
                {sub.name}
              </Text>
              <View style={styles.paymentRight}>
                <Text style={styles.paymentAmount}>
                  {fmtWithOriginal(sub.amount, sub.currency ?? "₺")}
                </Text>
                {date < today && (
                  <Text style={styles.paymentStatus}>{t("home_calendar.paid")}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
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
    monthLabel: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: "700",
    },
    strip: {
      marginHorizontal: -Spacing.xxl,
    },
    stripContent: {
      paddingHorizontal: Spacing.xxl,
      gap: CELL_GAP,
    },
    cell: {
      width: CELL_WIDTH,
      paddingVertical: Spacing.sm,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: colors.surfaceContainerLowest,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    // Ay geçişini ayırmak için sonraki ayın 1'inden önce biraz ekstra boşluk
    cellMonthStart: {
      marginLeft: Spacing.md,
    },
    monthStartLabel: {
      color: colors.primary,
      fontWeight: "800",
    },
    cellToday: {
      borderColor: colors.primary,
    },
    cellSelected: {
      backgroundColor: colors.primarySolid,
      borderColor: colors.primarySolid,
    },
    weekday: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.onSurfaceVariant,
      textTransform: "capitalize",
    },
    dayNumber: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      fontWeight: "800",
      marginTop: 2,
    },
    textPast: {
      opacity: 0.45,
    },
    textSelected: {
      color: "#ffffff",
      opacity: 1,
    },
    dotRow: {
      flexDirection: "row",
      gap: 3,
      height: 6,
      marginTop: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dayList: {
      marginTop: Spacing.lg,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 20,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    dayListTitle: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    emptyText: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
    },
    paymentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    paymentName: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "700",
      flex: 1,
    },
    paymentRight: {
      alignItems: "flex-end",
    },
    paymentAmount: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
    },
    paymentStatus: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 1,
    },
  });
