import SubscriptionIcon from "@/components/SubscriptionIcon";
import { CATEGORIES, Category } from "@/constants/categories";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useCurrency } from "@/hooks/useCurrency";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
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

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    subscriptions,
    updateSubscription,
    deleteSubscription,
    toggleActive,
    loading,
  } = useSubscriptionStore();

  const subscription = subscriptions.find((s) => s.id === id);
  const { fmt, fmtWithOriginal } = useCurrency();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);
  const [isEditing, setIsEditing] = useState(false);

  // Slide animation for edit overlay
  const editSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    Animated.spring(editSlide, {
      toValue: isEditing ? 0 : SCREEN_WIDTH,
      damping: 20,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [isEditing]);

  const initialDay = subscription
    ? new Date(subscription.next_billing_date).getDate().toString()
    : "";

  // Edit states
  const [editName, setEditName] = useState(subscription?.name ?? "");
  const [editAmount, setEditAmount] = useState(
    subscription?.amount.toString() ?? "",
  );
  const [editBillingDay, setEditBillingDay] = useState(initialDay);
  const [editCategory, setEditCategory] = useState<Category>(
    subscription?.category ?? "other",
  );
  const [editEmoji, setEditEmoji] = useState(subscription?.emoji ?? "📦");
  const [editColor, setEditColor] = useState(
    subscription?.color ?? AVAILABLE_COLORS[0],
  );
  const [editNotes, setEditNotes] = useState(subscription?.notes ?? "");

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

  const getDaysUntil = () => {
    const diff =
      new Date(subscription.next_billing_date).getTime() - Date.now();
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

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert(t("common.error"), t("new_sub.err_name"));
      return;
    }
    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert(t("common.error"), t("new_sub.err_amount"));
      return;
    }
    if (!editBillingDay) {
      Alert.alert(t("common.error"), t("new_sub.err_day"));
      return;
    }
    if (parseInt(editBillingDay, 10) < 1 || parseInt(editBillingDay, 10) > 31) {
      Alert.alert(t("common.error"), t("new_sub.err_day_range"));
      return;
    }

    const finalBillingDate = calculateNextBillingDate(editBillingDay);

    try {
      await updateSubscription(subscription.id, {
        name: editName.trim(),
        amount: parseFloat(editAmount),
        category: editCategory,
        emoji: editEmoji,
        color: editColor,
        next_billing_date: finalBillingDate,
        billing_cycle: "monthly",
        notes: editNotes.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert(t("common.error"), error.message);
    }
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
      {/* Editing modunda swipe-back kapatılır */}
      <Stack.Screen options={{ gestureEnabled: !isEditing }} />

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
          <View style={styles.heroCategoryBadge}>
            <Text style={styles.heroCategoryText}>
              {categoryLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Bento cards */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoCardLight}>
            <Text style={styles.bentoLabel}>
              {t("subscription_detail.monthly_cost")}
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
                {formatDate(subscription.next_billing_date)}
              </Text>
            </View>
            <Text style={styles.bentoDaysSub}>
              {t("subscription_detail.days_left", { days: daysUntil })}
            </Text>
          </View>
        </View>

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
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteButtonText}>
              {t("subscription_detail.delete")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── EDIT OVERLAY (slides in from right) ── */}
      <Animated.View
        style={[
          styles.editOverlay,
          { transform: [{ translateX: editSlide }] },
        ]}
        pointerEvents={isEditing ? "auto" : "none"}
      >
        {/* Edit overlay'in kendi frosted glass header'ı */}
        <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
          <BlurView intensity={72} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={styles.headerOverlay} />
          <View style={styles.headerBorder} />
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setIsEditing(false)}
            >
              <Ionicons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("subscription_detail.edit")}</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editScrollContent}
          >
            {/* Servis Adı */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.service_name")}</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
              />
            </View>

            {/* İkon Seçici */}
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
                      editEmoji === icon && { backgroundColor: editColor },
                    ]}
                    onPress={() => setEditEmoji(icon)}
                  >
                    <MaterialIcons
                      name={icon as any}
                      size={24}
                      color={
                        editEmoji === icon ? "#fff" : colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Renk Seçici */}
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
                    onPress={() => setEditColor(color)}
                  >
                    {editColor === color && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Aylık Maliyet ve Ödeme Günü */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t("new_sub.monthly_cost")}</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.currencySymbol}>
                    {subscription.currency ?? "₺"}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.amountInput]}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>{t("new_sub.billing_day")}</Text>
                <TextInput
                  style={styles.input}
                  value={editBillingDay}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, "");
                    setEditBillingDay(numericValue);
                  }}
                  placeholder="Örn: 15"
                  placeholderTextColor={colors.onSurfaceVariant + "80"}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            {/* Kategori */}
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
                      editCategory === cat.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setEditCategory(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        editCategory === cat.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {t(`categories.${cat.id}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Notlar */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t("subscription_detail.notes")}
              </Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={3}
                placeholder={t("subscription_detail.notes_placeholder")}
                placeholderTextColor={colors.onSurfaceVariant + "80"}
              />
            </View>

            {/* Kaydet Butonu */}
            <TouchableOpacity
              onPress={handleSaveEdit}
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
                  <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 120 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* ── Tab Bar ── */}
      <AppTabBar />

      {/* ── Detail view header (edit modunda gizlenir) ── */}
      {!isEditing && (
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
              onPress={() => setIsEditing(true)}
              style={styles.editBtn}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.editBtnText}>{t("subscription_detail.edit")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    ...StyleSheet.absoluteFillObject,
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

  // ── Edit Overlay ──
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    zIndex: 90,
  },
  editScrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 72,
  },

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
    backgroundColor: colors.errorContainer + "33",
  },
  deleteButtonText: {
    ...Typography.labelLg,
    color: colors.error,
    fontWeight: "700",
  },

  // ── Edit Form ──
  row: { flexDirection: "row", gap: Spacing.md },
  inputGroup: { marginBottom: Spacing.xl },
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
  horizontalScroll: { marginHorizontal: -4 },
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
  amountContainer: { flexDirection: "row", alignItems: "center" },
  currencySymbol: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 1,
    fontFamily: "Manrope",
    fontSize: 18,
    fontWeight: "700",
    color: colors.onSurfaceVariant,
  },
  amountInput: { flex: 1, paddingLeft: 42 },
  categoryScroll: { marginHorizontal: -4 },
  categoryChip: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  categoryChipActive: { backgroundColor: colors.primarySolid },
  categoryChipText: { ...Typography.labelMd, color: colors.onSurfaceVariant },
  categoryChipTextActive: { color: "#ffffff", fontWeight: "700" },
  notesInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
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

  // ── Not Found ──
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: {
    ...Typography.headlineMd,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.md,
  },
  backLink: { ...Typography.labelLg, color: colors.primary },
});
