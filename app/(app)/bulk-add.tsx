import type { AppColors } from "@/constants/colors";
import {
  TR_SERVICES,
  planCycle,
  planKey,
  type PopularService,
  type ServicePlan,
} from "@/constants/services";
import { BorderRadius, FIELD_HEIGHT, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getIconColorOn } from "@/lib/colorContrast";
import {
  addMonths,
  getNextPaymentDate,
  parseDateOnly,
  toDateOnly,
} from "@/lib/subscriptionDuration";
import DateField from "@/components/DateField";
import InfoLabel from "@/components/InfoLabel";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KEYBOARD_DONE_ID } from "@/components/KeyboardDoneBar";
import { formatAmountNumber, sanitizeAmountInput } from "@/lib/amountInput";

type Draft = {
  planKey: string;
  amount: string;
  currency: string;
  cycle: "monthly" | "yearly";
  /**
   * Sonraki ödeme 'YYYY-MM-DD' (varsayılan: bir ay sonrası). Tekli eklemedeki gibi
   * son ödeme de girilebilir; takvimin çapası olarak saklanır.
   */
  date: string;
};

// Plan değişince kullanıcının girdiği tarih korunur
const draftFromPlan = (plan: ServicePlan | undefined, prev?: Draft): Draft => ({
  planKey: plan ? planKey(plan) : "",
  amount: plan?.price ?? "",
  currency: plan?.forceCurrency ?? "₺",
  cycle: plan ? planCycle(plan) : "monthly",
  date: prev?.date ?? toDateOnly(addMonths(new Date(), 1)),
});

export default function BulkAddScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const { subscriptions, addSubscriptions, loading } = useSubscriptionStore();

  const [step, setStep] = useState<"select" | "review">("select");
  // Seçim sırasını korumak için dizi; taslaklar isimle eşleşir
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const existingNames = useMemo(
    () => new Set(subscriptions.map((s) => s.name.trim().toLocaleLowerCase("tr"))),
    [subscriptions],
  );

  const selectedServices = selected
    .map((name) => TR_SERVICES.find((s) => s.name === name))
    .filter((s): s is PopularService => !!s);

  const toggleService = (service: PopularService) => {
    setSelected((prev) =>
      prev.includes(service.name)
        ? prev.filter((n) => n !== service.name)
        : [...prev, service.name],
    );
    setDrafts((prev) =>
      prev[service.name] ? prev : { ...prev, [service.name]: draftFromPlan(service.plans[0]) },
    );
  };

  const updateDraft = (name: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  const removeFromReview = (name: string) => {
    const next = selected.filter((n) => n !== name);
    setSelected(next);
    if (next.length === 0) setStep("select");
  };

  const handleBack = () => {
    if (step === "review") {
      setStep("select");
      return;
    }
    router.back();
  };

  const handleSave = async () => {
    for (const service of selectedServices) {
      const draft = drafts[service.name];
      if (!draft.amount || parseFloat(draft.amount) <= 0) {
        Alert.alert(t("common.error"), t("bulk.err_amount", { name: service.name }));
        return;
      }
    }

    try {
      await addSubscriptions(
        selectedServices.map((service) => {
          const draft = drafts[service.name];
          // Girilen tarih takvimin çapası; sonraki ödeme ondan hesaplanır
          const nextPayment = getNextPaymentDate(schedulePreviewOf(draft));
          return {
            name: service.name,
            amount: parseFloat(draft.amount),
            currency: draft.currency,
            billing_cycle: draft.cycle,
            category: service.category,
            next_billing_date: toDateOnly(nextPayment ?? parseDateOnly(draft.date)),
            emoji: service.icon,
            color: service.color,
            is_active: true,
            duration_months: null,
            is_installment: false,
            first_billing_date: draft.date,
          };
        }),
      );
      router.back();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const schedulePreviewOf = (draft: Draft) => ({
    is_active: true,
    next_billing_date: draft.date,
    first_billing_date: draft.date,
    billing_cycle: draft.cycle,
    duration_months: null,
  });

  // Tekli eklemedeki ipucu: geçmiş bir tarih (son ödeme) girildiyse hesaplanan
  // sonraki ödeme, yıllıkta aylık karşılığı
  const hintOf = (draft: Draft) => {
    const nextPayment = getNextPaymentDate(schedulePreviewOf(draft));
    const scheduleHint =
      nextPayment && toDateOnly(nextPayment) !== draft.date
        ? t("new_sub.next_payment_preview", {
            date: nextPayment.toLocaleDateString(i18n.language, {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })
        : null;
    const parsedAmount = parseFloat(draft.amount);
    const yearlyHint =
      draft.cycle === "yearly" && parsedAmount > 0
        ? t("new_sub.yearly_monthly_equivalent", {
            amount: `${draft.currency}${formatAmountNumber((parsedAmount / 12))}`,
          })
        : null;
    return [scheduleHint, yearlyHint].filter(Boolean).join("\n");
  };

  const renderSelectStep = () => (
    <>
      <Text style={styles.stepTitle}>{t("bulk.select_title")}</Text>
      <Text style={styles.stepSubtitle}>{t("bulk.select_subtitle")}</Text>

      <View style={styles.grid}>
        {TR_SERVICES.map((service, index) => {
          const isSelected = selected.includes(service.name);
          const alreadyAdded = existingNames.has(
            service.name.trim().toLocaleLowerCase("tr"),
          );
          return (
            <TouchableOpacity
              key={service.name}
              style={[
                styles.serviceCard,
                // Satır sonu hariç sağ boşluk; son satır eksik kalınca kartlar sola hizalanır
                index % 3 !== 2 && styles.serviceCardSpacing,
                isSelected && styles.serviceCardSelected,
              ]}
              onPress={() => toggleService(service)}
              activeOpacity={0.8}
            >
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                </View>
              )}
              <View
                style={[styles.serviceIconContainer, { backgroundColor: service.color }]}
              >
                <MaterialIcons
                  name={service.icon as any}
                  size={28}
                  color={getIconColorOn(service.color)}
                />
              </View>
              <Text style={styles.serviceName} numberOfLines={1}>
                {service.name}
              </Text>
              <Text style={styles.serviceMeta} numberOfLines={1}>
                {alreadyAdded
                  ? t("bulk.already_added")
                  : t(`categories.${service.category}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  const renderReviewStep = () => (
    <>
      <Text style={styles.stepTitle}>{t("bulk.review_title")}</Text>
      <Text style={styles.stepSubtitle}>{t("bulk.review_subtitle")}</Text>

      {selectedServices.map((service) => {
        const draft = drafts[service.name];
        const hintText = hintOf(draft);
        return (
          <View key={service.name} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View
                style={[styles.reviewIcon, { backgroundColor: service.color }]}
              >
                <MaterialIcons
                  name={service.icon as any}
                  size={22}
                  color={getIconColorOn(service.color)}
                />
              </View>
              <Text style={styles.reviewName} numberOfLines={1}>
                {service.name}
              </Text>
              <TouchableOpacity
                onPress={() => removeFromReview(service.name)}
                hitSlop={10}
                accessibilityLabel={t("bulk.remove")}
              >
                <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {service.plans.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.planScroll}
              >
                {service.plans.map((plan) => {
                  const active = draft.planKey === planKey(plan);
                  return (
                    <TouchableOpacity
                      key={planKey(plan)}
                      style={[styles.planChip, active && styles.planChipActive]}
                      onPress={() =>
                        updateDraft(service.name, draftFromPlan(plan, draft))
                      }
                    >
                      <Text style={[styles.planChipText, active && styles.planChipTextActive]}>
                        {planCycle(plan) === "yearly"
                          ? t("bulk.plan_yearly", { label: plan.label })
                          : plan.label}
                      </Text>
                      <Text style={[styles.planChipPrice, active && styles.planChipTextActive]}>
                        {plan.forceCurrency ?? "₺"}
                        {plan.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <InfoLabel
                  label={draft.cycle === "yearly" ? t("bulk.amount_yearly") : t("bulk.amount")}
                  infoTitle={
                    draft.cycle === "yearly"
                      ? t("subscription_detail.yearly_cost")
                      : t("subscription_detail.monthly_cost")
                  }
                  infoMessage={
                    draft.cycle === "yearly"
                      ? t("new_sub.yearly_cost_info")
                      : t("new_sub.monthly_cost_info")
                  }
                />
                <View style={styles.amountContainer}>
                  <Text style={styles.currencySymbol}>{draft.currency}</Text>
                  <TextInput
                    inputAccessoryViewID={KEYBOARD_DONE_ID}
                    style={[styles.input, styles.amountInput]}
                    value={draft.amount}
                    onChangeText={(text) =>
                      updateDraft(service.name, { amount: sanitizeAmountInput(text) })
                    }
                    placeholder="0.00"
                    placeholderTextColor={colors.onSurfaceVariant + "80"}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <InfoLabel
                  label={t("new_sub.next_payment")}
                  infoTitle={t("new_sub.next_payment_info_title")}
                  infoMessage={t("new_sub.next_payment_info")}
                />
                <DateField
                  value={draft.date}
                  onChange={(date) => updateDraft(service.name, { date })}
                />
              </View>
            </View>
            {hintText !== "" && <Text style={styles.hint}>{hintText}</Text>}
          </View>
        );
      })}
    </>
  );

  const count = selected.length;

  return (
    <View style={styles.container}>
      {/* İkinci adımda kaydırarak geri gitmek girilen bilgileri kaybettirmesin */}
      <Stack.Screen options={{ gestureEnabled: step === "select" }} />
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("bulk.title")}</Text>
          <Text style={styles.stepIndicator}>
            {step === "select" ? "1/2" : "2/2"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardDismissMode="interactive"
          key={step}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 64 + Spacing.lg },
          ]}
        >
          {step === "select" ? renderSelectStep() : renderReviewStep()}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <TouchableOpacity
            onPress={step === "select" ? () => setStep("review") : handleSave}
            disabled={count === 0 || loading}
            activeOpacity={0.9}
            style={[styles.ctaWrapper, count === 0 && styles.ctaDisabled]}
          >
            <LinearGradient
              colors={[colors.primarySolid, colors.primarySolidContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {step === "select"
                    ? count === 0
                      ? t("bulk.continue_empty")
                      : t("bulk.continue", { count })
                    : t("bulk.save", { count })}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
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
    },
    backBtn: {
      marginRight: 12,
      padding: 4,
    },
    headerTitle: {
      ...Typography.headlineMd,
      color: colors.onSurface,
      fontWeight: "800",
      flex: 1,
    },
    stepIndicator: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: "700",
    },
    scrollContent: {
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    stepTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.onSurface,
      marginBottom: Spacing.xs,
    },
    stepSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurfaceVariant,
      marginBottom: Spacing.xl,
    },

    // ── Seçim ızgarası ──
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 12,
    },
    serviceCard: {
      width: "31.5%",
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 20,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.sm,
      alignItems: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    // 3 × 31.5% + 2 × 2.75% = 100%
    serviceCardSpacing: {
      marginRight: "2.75%",
    },
    serviceCardSelected: {
      backgroundColor: colors.primaryFixed,
      borderColor: colors.primary,
    },
    checkBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    serviceIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    serviceName: {
      ...Typography.labelMd,
      color: colors.onSurface,
      fontWeight: "700",
      textAlign: "center",
    },
    serviceMeta: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 2,
      textAlign: "center",
    },

    // ── Kontrol kartları ──
    reviewCard: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: 24,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    reviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    reviewIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewName: {
      ...Typography.labelLg,
      color: colors.onSurface,
      fontWeight: "800",
      flex: 1,
    },
    planScroll: {
      marginHorizontal: -4,
      marginBottom: Spacing.md,
    },
    planChip: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 8,
      marginHorizontal: 4,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    planChipActive: {
      backgroundColor: colors.primaryFixed,
      borderColor: colors.primary,
    },
    planChipText: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      fontWeight: "600",
    },
    planChipPrice: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    planChipTextActive: {
      color: colors.primary,
      fontWeight: "800",
    },
    row: {
      flexDirection: "row",
      gap: Spacing.md,
    },
    hint: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
      marginTop: Spacing.sm,
      marginLeft: 4,
    },
    label: {
      fontSize: 10,
      // ⓘ ikonlu etiketle (InfoLabel) aynı yükseklik; yan yana kutular hizalı kalsın
      lineHeight: 14,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.5,
      color: colors.onSurfaceVariant,
      marginBottom: Spacing.sm,
      marginLeft: 4,
    },
    input: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Platform.OS === "ios" ? 16 : 14,
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
      textAlignVertical: "center",
    },
    amountContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    currencySymbol: {
      position: "absolute",
      left: Spacing.lg,
      zIndex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: colors.onSurfaceVariant,
    },
    amountInput: {
      flex: 1,
      paddingLeft: 42,
      // Yanındaki tarih alanıyla aynı boy
      height: FIELD_HEIGHT,
      paddingVertical: 0,
    },

    // ── Alt buton ──
    bottomBar: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      backgroundColor: colors.surface,
    },
    ctaWrapper: {
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    ctaDisabled: {
      opacity: 0.5,
    },
    ctaButton: {
      borderRadius: BorderRadius.xl,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaText: {
      ...Typography.labelLg,
      color: "#ffffff",
      fontWeight: "800",
    },
  });
