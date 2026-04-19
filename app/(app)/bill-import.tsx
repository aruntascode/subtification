import { AppTabBar } from "@/components/AppTabBar";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  DetectedBill,
  formatBillImportAddress,
  getBillImportDomain,
  useBillImportStore,
} from "@/stores/billImportStore";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const UTILITY_COLOR = "#00796B";

export default function BillImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const {
    importAddress,
    detectedBills,
    loading,
    setupError,
    ensureImportAddress,
    fetchDetectedBills,
    markBillStatus,
  } = useBillImportStore();
  const addSubscription = useSubscriptionStore((state) => state.addSubscription);

  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const publicAddress = formatBillImportAddress(importAddress);
  const pendingBills = detectedBills.filter((bill) => bill.status === "pending");
  const importedBills = detectedBills.filter((bill) => bill.status === "imported");

  const load = useCallback(async () => {
    await ensureImportAddress();
    await fetchDetectedBills();
  }, [ensureImportAddress, fetchDetectedBills]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async (bill: DetectedBill) => {
    setAcceptingId(bill.id);
    try {
      await addSubscription({
        name: bill.service_name,
        amount: Number(bill.amount),
        currency: bill.currency || "₺",
        billing_cycle: bill.billing_cycle || "monthly",
        category: bill.category || "utilities",
        next_billing_date: bill.due_date || getDateAfterDays(30),
        emoji: "receipt-long",
        color: UTILITY_COLOR,
        is_active: true,
        notes: buildBillNote(bill),
      });
      await markBillStatus(bill.id, "imported");
      Alert.alert(t("bill_import.accepted_title"), t("bill_import.accepted_body"));
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleIgnore = async (bill: DetectedBill) => {
    try {
      await markBillStatus(bill.id, "ignored");
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("bill_import.title")}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 76 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heroBand}>
          <View style={styles.heroIcon}>
            <Ionicons name="mail-unread-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{t("bill_import.hero_title")}</Text>
          <Text style={styles.heroText}>{t("bill_import.hero_text")}</Text>
        </View>

        <View style={styles.addressPanel}>
          <Text style={styles.sectionLabel}>{t("bill_import.address_label")}</Text>
          <View style={styles.addressBox}>
            {loading && !publicAddress ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text selectable style={styles.addressText}>
                {publicAddress || t("bill_import.address_missing")}
              </Text>
            )}
          </View>
          <Text style={styles.helperText}>
            {t("bill_import.address_helper", { domain: getBillImportDomain() })}
          </Text>
          {setupError && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{setupError}</Text>
            </View>
          )}
        </View>

        <View style={styles.stepsBand}>
          <InstructionStep
            styles={styles}
            number="1"
            text={t("bill_import.step_forward")}
          />
          <InstructionStep
            styles={styles}
            number="2"
            text={t("bill_import.step_parse")}
          />
          <InstructionStep
            styles={styles}
            number="3"
            text={t("bill_import.step_accept")}
          />
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>{t("bill_import.pending_title")}</Text>
            <Text style={styles.sectionSubtitle}>
              {t("bill_import.pending_count", { count: pendingBills.length })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {pendingBills.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={28} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyTitle}>{t("bill_import.empty_title")}</Text>
            <Text style={styles.emptyText}>{t("bill_import.empty_text")}</Text>
          </View>
        ) : (
          <View style={styles.billList}>
            {pendingBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                styles={styles}
                accepting={acceptingId === bill.id}
                onAccept={() => handleAccept(bill)}
                onIgnore={() => handleIgnore(bill)}
              />
            ))}
          </View>
        )}

        {importedBills.length > 0 && (
          <View style={styles.importedBand}>
            <Text style={styles.sectionTitle}>{t("bill_import.imported_title")}</Text>
            {importedBills.slice(0, 5).map((bill) => (
              <View key={bill.id} style={styles.importedRow}>
                <Ionicons name="checkmark-circle" size={18} color={UTILITY_COLOR} />
                <Text style={styles.importedText}>
                  {bill.service_name} · {formatMoney(bill)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <AppTabBar />
    </View>
  );
}

function InstructionStep({
  styles,
  number,
  text,
}: {
  styles: ReturnType<typeof createStyles>;
  number: string;
  text: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function BillCard({
  bill,
  styles,
  accepting,
  onAccept,
  onIgnore,
}: {
  bill: DetectedBill;
  styles: ReturnType<typeof createStyles>;
  accepting: boolean;
  onAccept: () => void;
  onIgnore: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.billCard}>
      <View style={styles.billTopRow}>
        <View style={styles.billIcon}>
          <Ionicons name="flash-outline" size={20} color="#fff" />
        </View>
        <View style={styles.billInfo}>
          <Text style={styles.billName}>{bill.service_name}</Text>
          <Text style={styles.billMeta} numberOfLines={1}>
            {bill.raw_subject || bill.sender_email || t("bill_import.detected_mail")}
          </Text>
        </View>
        <View style={styles.confidencePill}>
          <Text style={styles.confidenceText}>
            {Math.round(Number(bill.confidence) * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.billDetailRow}>
        <View>
          <Text style={styles.detailLabel}>{t("bill_import.amount")}</Text>
          <Text style={styles.detailValue}>{formatMoney(bill)}</Text>
        </View>
        <View>
          <Text style={styles.detailLabel}>{t("bill_import.due_date")}</Text>
          <Text style={styles.detailValue}>
            {bill.due_date || t("bill_import.unknown_date")}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.ignoreButton} onPress={onIgnore}>
          <Text style={styles.ignoreText}>{t("bill_import.ignore")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.acceptText}>{t("bill_import.accept")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(bill: DetectedBill) {
  return `${bill.currency || "₺"}${Number(bill.amount).toFixed(2)}`;
}

function getDateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function buildBillNote(bill: DetectedBill) {
  const details = [
    "E-posta faturadan içe aktarıldı.",
    bill.raw_subject ? `Konu: ${bill.raw_subject}` : null,
    bill.sender_email ? `Gönderen: ${bill.sender_email}` : null,
  ].filter(Boolean);
  return details.join("\n");
}

const createStyles = (colors: AppColors, darkMode: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
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
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      fontWeight: "800",
    },
    scrollContent: {
      paddingHorizontal: Spacing.xxl,
      paddingBottom: Spacing.huge,
    },
    heroBand: {
      paddingVertical: Spacing.xxl,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: BorderRadius.xl,
      backgroundColor: colors.primaryFixed,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.lg,
    },
    heroTitle: {
      ...Typography.headlineLg,
      color: colors.onSurface,
      marginBottom: Spacing.sm,
    },
    heroText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      lineHeight: 21,
    },
    addressPanel: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.xxl,
      padding: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    sectionLabel: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    addressBox: {
      minHeight: 58,
      borderRadius: BorderRadius.xl,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: Spacing.lg,
    },
    addressText: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
      textAlign: "center",
    },
    helperText: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: Spacing.md,
      lineHeight: 17,
    },
    errorBox: {
      flexDirection: "row",
      gap: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.errorContainer + "33",
      padding: Spacing.md,
      marginTop: Spacing.md,
    },
    errorText: {
      ...Typography.bodySm,
      color: colors.error,
      flex: 1,
      lineHeight: 17,
    },
    stepsBand: {
      gap: Spacing.md,
      marginBottom: Spacing.xxl,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberText: {
      ...Typography.labelMd,
      color: "#fff",
      fontWeight: "800",
    },
    stepText: {
      ...Typography.bodyMd,
      color: colors.onSurface,
      flex: 1,
      lineHeight: 20,
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
    },
    sectionSubtitle: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    refreshButton: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.primaryFixed,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: Spacing.huge,
      paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
      ...Typography.headlineSm,
      color: colors.onSurface,
      marginTop: Spacing.md,
      textAlign: "center",
    },
    emptyText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
      marginTop: Spacing.xs,
      textAlign: "center",
      lineHeight: 20,
    },
    billList: {
      gap: Spacing.md,
    },
    billCard: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: BorderRadius.xxl,
      padding: Spacing.lg,
    },
    billTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    billIcon: {
      width: 42,
      height: 42,
      borderRadius: BorderRadius.lg,
      backgroundColor: UTILITY_COLOR,
      alignItems: "center",
      justifyContent: "center",
    },
    billInfo: {
      flex: 1,
      minWidth: 0,
    },
    billName: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
    },
    billMeta: {
      ...Typography.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    confidencePill: {
      borderRadius: BorderRadius.full,
      backgroundColor: colors.tertiaryFixed + "33",
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    confidenceText: {
      ...Typography.labelSm,
      color: colors.tertiary,
      fontWeight: "800",
    },
    billDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.outlineVariant + "44",
    },
    detailLabel: {
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
    },
    detailValue: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
      marginTop: 2,
    },
    actionRow: {
      flexDirection: "row",
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    ignoreButton: {
      flex: 1,
      borderRadius: BorderRadius.xl,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: "center",
      paddingVertical: Spacing.md,
    },
    ignoreText: {
      ...Typography.labelLg,
      color: colors.onSurfaceVariant,
      fontWeight: "800",
    },
    acceptButton: {
      flex: 1,
      borderRadius: BorderRadius.xl,
      backgroundColor: colors.primary,
      alignItems: "center",
      paddingVertical: Spacing.md,
    },
    acceptText: {
      ...Typography.labelLg,
      color: "#fff",
      fontWeight: "800",
    },
    importedBand: {
      marginTop: Spacing.xxxl,
      gap: Spacing.sm,
    },
    importedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    importedText: {
      ...Typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
  });
