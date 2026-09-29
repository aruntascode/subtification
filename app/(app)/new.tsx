import { CATEGORIES, Category } from "@/constants/categories";
import {
  TR_SERVICES,
  planCycle,
  planKey,
  type PopularService,
  type ServicePlan,
} from "@/constants/services";
import DateField from "@/components/DateField";
import InfoLabel from "@/components/InfoLabel";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, FIELD_HEIGHT, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import DurationPicker from "@/components/DurationPicker";
import {
  addMonths,
  getNextPaymentDate,
  parseDateOnly,
  toDateOnly,
} from "@/lib/subscriptionDuration";
import { getIconColorOn, isLightColor } from "@/lib/colorContrast";
import { KEYBOARD_DONE_ID } from "@/components/KeyboardDoneBar";
import { sanitizeAmountInput } from "@/lib/amountInput";

const AVAILABLE_ICONS = [
  "apps",
  "play-circle-outline",
  "library-music",
  "tv",
  "movie",
  "shopping-cart",
  "movie-filter",
  "live-tv",
  "music-note",
  "sports-soccer",
  "sports-esports",
  "videogame-asset",
  "sports",
  "auto-awesome",
  "psychology",
  "cloud-queue",
  "fitness-center",
  "wifi",
  "home",
  "directions-car",
  "restaurant",
  "school",
  "flight",
  "phone-iphone",
  "account-balance-wallet",
  "credit-card",
  "favorite",
];

const AVAILABLE_COLORS = [
  "#E53935", // kırmızı
  "#FB8C00", // turuncu
  "#F9A825", // sarı
  "#43A047", // yeşil
  "#1E88E5", // mavi
  "#8E24AA", // mor
  "#D81B60", // pembe
  "#6D4C41", // kahverengi
  "#757575", // gri
  "#212121", // siyah
  "#FFFFFF", // beyaz
];

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { addSubscription, loading } = useSubscriptionStore();
  const { custom } = useLocalSearchParams<{ custom?: string }>();
  const insets = useSafeAreaInsets();
  const isCustomMode = custom === "true";
  const scrollRef = useRef<ScrollView>(null);
  const formYRef = useRef(0);
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  // 'YYYY-MM-DD'; aylıkta ayın günü, yıllıkta gün+ay bu tarihten alınır
  // Abonelikte "sonraki ödeme" (varsayılan: bir ay sonrası), taksitte ilk taksit.
  // Hangisi olursa olsun takvimin çapası olarak saklanır.
  const [billingDate, setBillingDate] = useState(() => toDateOnly(addMonths(new Date(), 1)));
  // Döngü seçilen plandan gelir (yıllık plan çipi → yıllık); plan yoksa kullanıcı seçer
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [category, setCategory] = useState<Category>("entertainment");
  const [activeColor, setActiveColor] = useState(AVAILABLE_COLORS[4]);
  const [activeIcon, setActiveIcon] = useState(AVAILABLE_ICONS[0]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [currency, setCurrency] = useState("₺");
  const [isInstallment, setIsInstallment] = useState(false);
  const [durationMonths, setDurationMonths] = useState<number | null>(null);

  // YENİ: Notlar State'i
  const [notes, setNotes] = useState("");

  const [availablePlans, setAvailablePlans] = useState<ServicePlan[]>([]);
  const [activePlanKey, setActivePlanKey] = useState("");


  const scrollToSubscriptionForm = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formYRef.current - Spacing.md, 0),
        animated: true,
      });
    });
  };

  const handleSelectService = (service: PopularService) => {
    // Popüler servisler abonelik; taksit modundaysa geri dön
    setIsInstallment(false);
    setName(service.name);
    setCategory(service.category);
    setActiveColor(service.color);
    setActiveIcon(service.icon);
    setAvailablePlans(service.plans);

    // Varsayılan olarak ilk aylık plan
    const firstPlan =
      service.plans.find((p) => planCycle(p) === "monthly") ?? service.plans[0];
    if (firstPlan) {
      handleSelectPlan(firstPlan);
    } else {
      setActivePlanKey("");
      setAmount("");
      setCurrency("₺");
      setBillingCycle("monthly");
    }

    scrollToSubscriptionForm();
  };

  const handleSelectPlan = (plan: ServicePlan) => {
    setActivePlanKey(planKey(plan));
    setAmount(plan.price);
    setCurrency(plan.forceCurrency ?? "₺");
    setBillingCycle(planCycle(plan));
    if (planCycle(plan) === "yearly") setDurationMonths(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error"), t("new_sub.err_name"));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t("common.error"), t("new_sub.err_amount"));
      return;
    }
    if (isInstallment && !durationMonths) {
      Alert.alert(t("common.error"), t("duration.err_installment_months"));
      return;
    }

    // Girilen başlangıç tarihi takvimin çapası; sonraki ödeme ondan hesaplanır
    const nextPayment = getNextPaymentDate(schedulePreview);

    try {
      await addSubscription({
        name: name.trim(),
        amount: parseFloat(amount),
        currency: currency,
        billing_cycle: isInstallment ? "monthly" : billingCycle,
        category: category,
        next_billing_date: toDateOnly(nextPayment ?? parseDateOnly(billingDate)),
        emoji: activeIcon,
        color: activeColor,
        is_active: true,
        notes: notes.trim() || undefined, // YENİ: Notları kaydet
        duration_months: durationMonths,
        is_installment: isInstallment,
        first_billing_date: billingDate,
      });
      router.back();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
  };

  const handleSelectCycle = (cycle: "monthly" | "yearly") => {
    setBillingCycle(cycle);
    // Yıllık abonelikte süre (ay) kullanılmaz
    if (cycle === "yearly") setDurationMonths(null);
  };

  const handleSelectType = (installment: boolean) => {
    if (installment === isInstallment) return;
    setIsInstallment(installment);
    if (installment) {
      // Taksit süresiz ve aylık olmak zorunda; plan listesi taksite uymaz
      setAvailablePlans([]);
      setActivePlanKey("");
      setBillingCycle("monthly");
      if (durationMonths === null) setDurationMonths(12);
      if (!name.trim()) {
        setCategory("shopping");
        setActiveIcon("credit-card");
      }
    } else {
      // Taksit için seçilen süre aboneliğe taşınmasın; abonelik varsayılan olarak süresiz
      setDurationMonths(null);
    }
  };

  const durationSummary = (() => {
    if (!durationMonths) return null;
    const last = addMonths(parseDateOnly(billingDate), durationMonths - 1);
    const lastLabel = last.toLocaleDateString(i18n.language, {
      month: "long",
      year: "numeric",
    });
    const parsedAmount = parseFloat(amount);
    if (isInstallment && parsedAmount > 0) {
      return t("duration.installment_summary", {
        total: `${currency}${(parsedAmount * durationMonths).toFixed(2)}`,
        date: lastLabel,
      });
    }
    return t("duration.summary", { date: lastLabel });
  })();

  // Formdaki değerlerle takvim önizlemesi: "Sonraki ödeme: 15 Ekim 2026"
  const schedulePreview = {
    is_active: true,
    next_billing_date: billingDate,
    first_billing_date: billingDate,
    billing_cycle: isInstallment ? ("monthly" as const) : billingCycle,
    duration_months: durationMonths,
  };
  const nextPaymentPreview = getNextPaymentDate(schedulePreview);
  const previewText = nextPaymentPreview
    ? t("new_sub.next_payment_preview", {
        date: nextPaymentPreview.toLocaleDateString(i18n.language, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      })
    : t("duration.finished");
  // Girilen tarih zaten sonraki ödemeyse ek bilgiye gerek yok; geçmiş bir tarih
  // (son ödeme) girildiyse hesaplanan sonraki ödemeyi göster
  const scheduleHint =
    !isInstallment &&
    nextPaymentPreview &&
    toDateOnly(nextPaymentPreview) === billingDate
      ? null
      : previewText;

  const parsedAmount = parseFloat(amount);
  const yearlyHint =
    !isInstallment && billingCycle === "yearly" && parsedAmount > 0
      ? t("new_sub.yearly_monthly_equivalent", {
          amount: `${currency}${(parsedAmount / 12).toFixed(2)}`,
        })
      : null;

  const hintText = [scheduleHint, yearlyHint].filter(Boolean).join("\n");

  // Tutar etiketindeki ⓘ: girilen tutarın neyi ifade ettiğini açıklar
  const amountInfo = isInstallment
    ? {
        infoTitle: t("duration.installment_amount"),
        infoMessage: t("duration.installment_amount_info"),
      }
    : billingCycle === "yearly"
      ? {
          infoTitle: t("subscription_detail.yearly_cost"),
          infoMessage: t("new_sub.yearly_cost_info"),
        }
      : {
          infoTitle: t("subscription_detail.monthly_cost"),
          infoMessage: t("new_sub.monthly_cost_info"),
        };

  const displayedServices = showAllServices
    ? TR_SERVICES
    : TR_SERVICES.slice(0, 6);

  return (
    <View style={styles.container}>
      {/* Frosted Glass Header */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerBorder} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("new_sub.title")}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 64 }]}
        >
          {!isCustomMode && <View style={styles.popularSection}>
            <View style={styles.popularHeader}>
              <Text style={styles.popularTitle}>
                {t("new_sub.popular_services")}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAllServices(!showAllServices)}
              >
                <Text style={styles.viewAllText}>
                  {showAllServices
                    ? t("new_sub.view_less")
                    : t("new_sub.view_all")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {displayedServices.map((service) => (
                <TouchableOpacity
                  key={service.name}
                  style={[
                    styles.serviceCard,
                    name === service.name && styles.serviceCardSelected,
                  ]}
                  onPress={() => handleSelectService(service)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.serviceIconContainer,
                      { backgroundColor: service.color },
                    ]}
                  >
                    <MaterialIcons
                      name={service.icon as any}
                      size={32}
                      color={getIconColorOn(service.color)}
                    />
                  </View>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceCategoryText}>
                    {t(`categories.${service.category}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>}

          <View
            style={styles.card}
            onLayout={(event) => {
              formYRef.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIcon}>
                <MaterialIcons
                  name="edit-square"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t("new_sub.form_title")}</Text>
                <Text style={styles.cardSubtitle}>
                  {t("new_sub.form_subtitle")}
                </Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("duration.type")}</Text>
              <View style={styles.currencyRow}>
                {[false, true].map((installment) => (
                  <TouchableOpacity
                    key={String(installment)}
                    style={[
                      styles.currencyBtn,
                      isInstallment === installment && styles.currencyBtnActive,
                    ]}
                    onPress={() => handleSelectType(installment)}
                  >
                    <Text
                      style={[
                        styles.typeBtnText,
                        isInstallment === installment && styles.currencyBtnTextActive,
                      ]}
                    >
                      {installment
                        ? t("duration.type_installment")
                        : t("duration.type_subscription")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.service_name")}</Text>
              <TextInput
                style={styles.input}
                placeholder={
                  isInstallment
                    ? t("duration.installment_name_placeholder")
                    : t("new_sub.name_placeholder")
                }
                placeholderTextColor={colors.onSurfaceVariant + "80"}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.icon")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {AVAILABLE_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconChip,
                      activeIcon === icon && { backgroundColor: activeColor },
                    ]}
                    onPress={() => setActiveIcon(icon)}
                  >
                    <MaterialIcons
                      name={icon as any}
                      size={24}
                      color={
                        activeIcon === icon
                          ? getIconColorOn(activeColor)
                          : colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.color")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {AVAILABLE_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorChip,
                      { backgroundColor: color },
                      isLightColor(color) && styles.colorChipLight,
                    ]}
                    onPress={() => setActiveColor(color)}
                  >
                    {activeColor === color && (
                      <Ionicons name="checkmark" size={20} color={getIconColorOn(color)} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.currency")}</Text>
              <View style={styles.currencyRow}>
                {["₺", "$", "€", "£"].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.currencyBtn,
                      currency === c && styles.currencyBtnActive,
                    ]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text
                      style={[
                        styles.currencyBtnText,
                        currency === c && styles.currencyBtnTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {availablePlans.length > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("new_sub.plan_selection")}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.planScroll}
                >
                  {availablePlans.map((plan) => (
                    <TouchableOpacity
                      key={planKey(plan)}
                      style={[
                        styles.planChip,
                        activePlanKey === planKey(plan) && styles.planChipActive,
                      ]}
                      onPress={() => handleSelectPlan(plan)}
                    >
                      <Text
                        style={[
                          styles.planChipText,
                          activePlanKey === planKey(plan) &&
                            styles.planChipTextActive,
                        ]}
                      >
                        {planCycle(plan) === "yearly"
                          ? t("bulk.plan_yearly", { label: plan.label })
                          : plan.label}
                      </Text>
                      <Text
                        style={[
                          styles.planChipPrice,
                          activePlanKey === planKey(plan) &&
                            styles.planChipTextActive,
                        ]}
                      >
                        {plan.forceCurrency || "₺"}
                        {plan.price}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Plan yoksa (özel abonelik) döngü elle seçilir; taksit her zaman aylık */}
            {availablePlans.length === 0 && !isInstallment && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("subscription_detail.billing_cycle")}</Text>
                <View style={styles.currencyRow}>
                  {(["monthly", "yearly"] as const).map((cycle) => (
                    <TouchableOpacity
                      key={cycle}
                      style={[
                        styles.currencyBtn,
                        billingCycle === cycle && styles.currencyBtnActive,
                      ]}
                      onPress={() => handleSelectCycle(cycle)}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          billingCycle === cycle && styles.currencyBtnTextActive,
                        ]}
                      >
                        {t(`cycles.${cycle}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <InfoLabel
                  label={
                    isInstallment
                      ? t("duration.installment_amount")
                      : billingCycle === "yearly"
                        ? t("new_sub.yearly_cost")
                        : t("new_sub.monthly_cost")
                  }
                  {...amountInfo}
                />
                <View style={styles.amountContainer}>
                  <Text style={styles.currencySymbol}>{currency}</Text>
                  <TextInput
                    inputAccessoryViewID={KEYBOARD_DONE_ID}
                    style={[styles.input, styles.amountInput]}
                    placeholder="0.00"
                    placeholderTextColor={colors.onSurfaceVariant + "80"}
                    value={amount}
                    onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                {isInstallment ? (
                  <InfoLabel label={t("duration.first_installment")} />
                ) : (
                  <InfoLabel
                    label={t("new_sub.next_payment")}
                    infoTitle={t("new_sub.next_payment_info_title")}
                    infoMessage={t("new_sub.next_payment_info")}
                  />
                )}
                <DateField value={billingDate} onChange={setBillingDate} />
              </View>
            </View>
            {hintText !== "" && <Text style={styles.cycleHint}>{hintText}</Text>}

            {billingCycle === "monthly" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {isInstallment
                  ? t("duration.installment_months")
                  : t("duration.label")}
              </Text>
              <DurationPicker
                value={durationMonths}
                onChange={setDurationMonths}
                allowUnlimited={!isInstallment}
              />
              {durationSummary && (
                <Text style={styles.durationSummary}>{durationSummary}</Text>
              )}
            </View>
            )}


            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.category")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      category === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {t(`categories.${cat.id}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* YENİ: NOTLAR KISMI */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("subscription_detail.notes")}</Text>
              <TextInput
                inputAccessoryViewID={KEYBOARD_DONE_ID}
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder={t("subscription_detail.notes_placeholder")}
                placeholderTextColor={colors.onSurfaceVariant + "80"}
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.9}
              style={styles.saveBtnWrapper}
            >
              <LinearGradient
                colors={[colors.primarySolid, colors.primarySolidContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {t("new_sub.save_button")}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge * 3,
  },
  popularSection: {
    marginBottom: Spacing.xxxl,
  },
  popularHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  popularTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
  },
  viewAllText: {
    ...Typography.labelMd,
    color: colors.primary,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  serviceCard: {
    width: "48%",
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: 4,
  },
  serviceCardSelected: {
    backgroundColor: colors.primaryFixed,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: Spacing.xl - 2,
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  serviceName: {
    ...Typography.labelLg,
    color: colors.onSurface,
    fontWeight: "700",
  },
  serviceCategoryText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 32,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  cardHeaderIcon: {
    width: 56,
    height: 56,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.onSurface,
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    marginTop: 2,
    flexShrink: 1,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
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
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    textAlignVertical: "center",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  horizontalScroll: {
    marginHorizontal: -4,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  colorChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  colorChipLight: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  currencyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  currencyBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  currencyBtnActive: {
    backgroundColor: colors.primaryFixed,
    borderColor: colors.primary,
  },
  currencyBtnText: {
    ...Typography.headlineSm,
    color: colors.onSurfaceVariant,
  },
  typeBtnText: {
    ...Typography.labelMd,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
  },
  cycleHint: {
    ...Typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: -Spacing.md,
    marginBottom: Spacing.xl,
    marginLeft: 4,
  },
  durationSummary: {
    ...Typography.labelMd,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.sm,
    marginLeft: 4,
  },
  currencyBtnTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencySymbol: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 1,
    fontFamily: "Manrope",
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
  planScroll: {
    marginHorizontal: -4,
  },
  planChip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
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
  categoryScroll: {
    marginHorizontal: -4,
  },
  categoryChip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  categoryChipActive: {
    backgroundColor: colors.primarySolid,
  },
  categoryChipText: {
    ...Typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  categoryChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  /* YENİ: NOTLAR STİLİ */
  notesInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg, // Alttan da ferahlık eklendi
  },

  saveBtnWrapper: {
    marginTop: Spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  saveButton: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonText: {
    ...Typography.labelLg,
    color: "#ffffff",
    fontWeight: "800",
  },
});
