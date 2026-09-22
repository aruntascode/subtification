import { CATEGORIES, Category } from "@/constants/categories";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
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
import { AppTabBar } from "@/components/AppTabBar";

const TR_SERVICES = [
  {
    name: "Netflix",
    icon: "play-circle-outline",
    color: "#E50914",
    category: "entertainment",
    plans: [
      { label: "Temel", price: "149.99" },
      { label: "Standart", price: "229.99" },
      { label: "Özel (4K)", price: "299.99" },
    ],
  },
  {
    name: "Spotify",
    icon: "library-music",
    color: "#1DB954",
    category: "entertainment",
    plans: [
      { label: "Öğrenci", price: "32.99" },
      { label: "Bireysel", price: "59.99" },
      { label: "Duo", price: "79.99" },
      { label: "Aile", price: "99.99" },
    ],
  },
  {
    name: "YouTube Premium",
    icon: "smart-display",
    color: "#FF0000",
    category: "entertainment",
    plans: [
      { label: "Öğrenci", price: "37.99" },
      { label: "Bireysel", price: "57.99" },
      { label: "Aile", price: "115.99" },
    ],
  },
  {
    name: "Exxen",
    icon: "tv",
    color: "#F2E82E",
    category: "entertainment",
    plans: [
      { label: "Reklamlı", price: "99.90" },
      { label: "Reklamsız", price: "137.90" },
    ],
  },
  {
    name: "BluTV",
    icon: "movie",
    color: "#0061FF",
    category: "entertainment",
    plans: [
      { label: "Aylık", price: "99.90" },
      { label: "Yıllık (Ay)", price: "49.90" },
    ],
  },
  {
    name: "Amazon Prime",
    icon: "shopping-cart",
    color: "#00A8E1",
    category: "entertainment",
    plans: [{ label: "Standart", price: "39.00" }],
  },
  {
    name: "ChatGPT Plus",
    icon: "auto-awesome",
    color: "#10A37F",
    category: "productivity",
    plans: [{ label: "Plus", price: "20.00", forceCurrency: "$" }],
  },
  {
    name: "iCloud+",
    icon: "cloud-queue",
    color: "#3283f6",
    category: "productivity",
    plans: [
      { label: "50 GB", price: "12.99" },
      { label: "200 GB", price: "39.99" },
      { label: "2 TB", price: "129.99" },
    ],
  },
  {
    name: "Spor Salonu",
    icon: "fitness-center",
    color: "#FF5722",
    category: "health",
    plans: [],
  },
  {
    name: "Ev İnterneti",
    icon: "wifi",
    color: "#607D8B",
    category: "utilities",
    plans: [],
  },
];

const AVAILABLE_ICONS = [
  "apps",
  "play-circle-outline",
  "library-music",
  "tv",
  "movie",
  "shopping-cart",
  "auto-awesome",
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
  "favorite",
];

const AVAILABLE_COLORS = [
  "#0B7285",
  "#2D6CDF",
  "#00796B",
  "#10A37F",
  "#7C3AED",
  "#D9467B",
  "#EA580C",
  "#B45309",
  "#64748B",
  "#111827",
];

const sanitizeAmountInput = (value: string) => {
  const normalized = value.replace(",", ".");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const digitsOnly = whole.replace(/\D/g, "");
  const decimal = decimalParts.join("").replace(/\D/g, "");

  return decimalParts.length > 0 ? `${digitsOnly}.${decimal}` : digitsOnly;
};

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [billingDay, setBillingDay] = useState("");
  const [category, setCategory] = useState<Category>("entertainment");
  const [activeColor, setActiveColor] = useState(AVAILABLE_COLORS[0]);
  const [activeIcon, setActiveIcon] = useState(AVAILABLE_ICONS[0]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [currency, setCurrency] = useState("₺");

  // YENİ: Notlar State'i
  const [notes, setNotes] = useState("");

  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [activePlanLabel, setActivePlanLabel] = useState("");

  const scrollToSubscriptionForm = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formYRef.current - Spacing.md, 0),
        animated: true,
      });
    });
  };

  const handleSelectService = (service: any) => {
    setName(service.name);
    setCategory(service.category as Category);
    setActiveColor(service.color);
    setActiveIcon(service.icon);

    if (service.plans && service.plans.length > 0) {
      setAvailablePlans(service.plans);
      setActivePlanLabel(service.plans[0].label);
      setAmount(service.plans[0].price);

      if (service.plans[0].forceCurrency) {
        setCurrency(service.plans[0].forceCurrency);
      } else {
        setCurrency("₺");
      }
    } else {
      setAvailablePlans([]);
      setActivePlanLabel("");
      setAmount("");
      setCurrency("₺");
    }

    scrollToSubscriptionForm();
  };

  const handleSelectPlan = (plan: any) => {
    setActivePlanLabel(plan.label);
    setAmount(plan.price);
    if (plan.forceCurrency) {
      setCurrency(plan.forceCurrency);
    }
  };

  const calculateNextBillingDate = (dayStr: string) => {
    if (!dayStr) return new Date().toISOString().split("T")[0];

    const day = parseInt(dayStr, 10);
    const today = new Date();
    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();

    if (day <= today.getDate()) {
      targetMonth++;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }
    }

    const nextDate = new Date(targetYear, targetMonth, day);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
    const dd = String(nextDate.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
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
    if (!billingDay) {
      Alert.alert(t("common.error"), t("new_sub.err_day"));
      return;
    }
    if (parseInt(billingDay, 10) < 1 || parseInt(billingDay, 10) > 31) {
      Alert.alert(t("common.error"), t("new_sub.err_day_range"));
      return;
    }

    const finalBillingDate = calculateNextBillingDate(billingDay);

    try {
      await addSubscription({
        name: name.trim(),
        amount: parseFloat(amount),
        currency: currency,
        billing_cycle: "monthly",
        category: category,
        next_billing_date: finalBillingDate,
        emoji: activeIcon,
        color: activeColor,
        is_active: true,
        notes: notes.trim() || undefined, // YENİ: Notları kaydet
      });
      router.back();
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
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
                      color="#fff"
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
              <Text style={styles.label}>{t("new_sub.service_name")}</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Ev Kirası"
                placeholderTextColor={colors.onSurfaceVariant + "80"}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>İKON</Text>
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
                        activeIcon === icon ? "#fff" : colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>RENK</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {AVAILABLE_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorChip, { backgroundColor: color }]}
                    onPress={() => setActiveColor(color)}
                  >
                    {activeColor === color && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
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

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t("new_sub.monthly_cost")}</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.currencySymbol}>{currency}</Text>
                  <TextInput
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
                <Text style={styles.label}>{t("new_sub.billing_day")}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: 15"
                  placeholderTextColor={colors.onSurfaceVariant + "80"}
                  value={billingDay}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, "");
                    setBillingDay(numericValue);
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
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
                      key={plan.label}
                      style={[
                        styles.planChip,
                        activePlanLabel === plan.label && styles.planChipActive,
                      ]}
                      onPress={() => handleSelectPlan(plan)}
                    >
                      <Text
                        style={[
                          styles.planChipText,
                          activePlanLabel === plan.label &&
                            styles.planChipTextActive,
                        ]}
                      >
                        {plan.label}
                      </Text>
                      <Text
                        style={[
                          styles.planChipPrice,
                          activePlanLabel === plan.label &&
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
      <AppTabBar />
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
