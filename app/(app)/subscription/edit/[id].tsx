import { BillingCycle, CATEGORIES, Category } from "@/constants/categories";
import DateField from "@/components/DateField";
import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useSubscriptionStore } from "@/stores/subscriptionStore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import DurationPicker from "@/components/DurationPicker";
import { getIconColorOn, isLightColor } from "@/lib/colorContrast";
import { toDateOnly } from "@/lib/subscriptionDuration";
import { KEYBOARD_DONE_ID } from "@/components/KeyboardDoneBar";

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

export default function EditSubscriptionScreen() {
  // cycle/amount: Analizlerdeki "Yıllığa geç" ipucundan ön doldurma
  const { id, cycle: cycleParam, amount: amountParam } = useLocalSearchParams<{
    id: string;
    cycle?: string;
    amount?: string;
  }>();
  const router = useRouter();
  const { subscriptions, updateSubscription, loading } = useSubscriptionStore();

  const subscription = subscriptions.find((s) => s.id === id);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors, darkMode, blurTint } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, darkMode), [colors, darkMode]);

  // Süreli kayıtta tarih alanı ilk ödemeyi, değilse sonraki ödemeyi düzenler
  const initialDate = subscription
    ? (subscription.first_billing_date ?? subscription.next_billing_date).slice(0, 10)
    : toDateOnly(new Date());

  // Edit states
  const [editName, setEditName] = useState(subscription?.name ?? "");
  const [editAmount, setEditAmount] = useState(
    amountParam ?? subscription?.amount.toString() ?? "",
  );
  const [editDate, setEditDate] = useState(initialDate);
  // Eski haftalık/3 aylık kayıtlar, kullanıcı değiştirmedikçe kendi döngüsünde kalır
  const [editCycle, setEditCycle] = useState<BillingCycle>(
    cycleParam === "yearly" ? "yearly" : (subscription?.billing_cycle ?? "monthly"),
  );
  const [editCategory, setEditCategory] = useState<Category>(
    subscription?.category ?? "other",
  );
  const [editEmoji, setEditEmoji] = useState(subscription?.emoji ?? "📦");
  const [editColor, setEditColor] = useState(
    subscription?.color ?? AVAILABLE_COLORS[0],
  );
  const [editNotes, setEditNotes] = useState(subscription?.notes ?? "");
  const [editDuration, setEditDuration] = useState<number | null>(
    cycleParam === "yearly" ? null : (subscription?.duration_months ?? null),
  );

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

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert(t("common.error"), t("new_sub.err_name"));
      return;
    }
    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert(t("common.error"), t("new_sub.err_amount"));
      return;
    }
    if (subscription.is_installment && !editDuration) {
      Alert.alert(t("common.error"), t("duration.err_installment_months"));
      return;
    }

    // Yıllık abonelikte süre (ay) kullanılmaz; taksit her zaman aylık
    const cycle: BillingCycle = subscription.is_installment ? "monthly" : editCycle;
    const duration = cycle === "yearly" ? null : editDuration;

    try {
      await updateSubscription(subscription.id, {
        name: editName.trim(),
        amount: parseFloat(editAmount),
        category: editCategory,
        emoji: editEmoji,
        color: editColor,
        next_billing_date: editDate,
        billing_cycle: cycle,
        notes: editNotes.trim() || undefined,
        duration_months: duration,
        // Süreli kayıtta takvim bu tarihten başlar
        first_billing_date: duration ? editDate : null,
      });
      router.back();
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
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
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.editScrollContent,
            // Başlık çubuğu (çentik + 56px) ve alttaki sekme çubuğu içeriği örtmesin
            { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 80 },
          ]}
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
                      editEmoji === icon
                        ? getIconColorOn(editColor)
                        : colors.onSurfaceVariant
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
                  style={[
                    styles.colorChip,
                    { backgroundColor: color },
                    isLightColor(color) && styles.colorChipLight,
                  ]}
                  onPress={() => setEditColor(color)}
                >
                  {editColor === color && (
                    <Ionicons name="checkmark" size={20} color={getIconColorOn(color)} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Ödeme döngüsü (taksit her zaman aylık) */}
          {!subscription.is_installment && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("new_sub.billing_cycle")}</Text>
              <View style={styles.cycleRow}>
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <TouchableOpacity
                    key={cycle}
                    style={[styles.cycleBtn, editCycle === cycle && styles.cycleBtnActive]}
                    onPress={() => setEditCycle(cycle)}
                  >
                    <Text
                      style={[
                        styles.cycleBtnText,
                        editCycle === cycle && styles.cycleBtnTextActive,
                      ]}
                    >
                      {t(`new_sub.cycle_${cycle}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tutar ve ödeme tarihi */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {subscription.is_installment
                  ? t("duration.installment_amount")
                  : editCycle === "yearly"
                    ? t("new_sub.yearly_cost")
                    : t("new_sub.monthly_cost")}
              </Text>
              <View style={styles.amountContainer}>
                <Text style={styles.currencySymbol}>
                  {subscription.currency ?? "₺"}
                </Text>
                <TextInput
                  inputAccessoryViewID={KEYBOARD_DONE_ID}
                  style={[styles.input, styles.amountInput]}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>
                {subscription.is_installment
                  ? t("duration.first_installment")
                  : editDuration && editCycle !== "yearly"
                    ? t("new_sub.first_payment")
                    : t("new_sub.next_payment")}
              </Text>
              <DateField value={editDate} onChange={setEditDate} />
            </View>
          </View>

          {/* Süre / Taksit sayısı (yıllıkta gizli) */}
          {editCycle !== "yearly" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {subscription.is_installment
                ? t("duration.installment_months")
                : t("duration.label")}
            </Text>
            <DurationPicker
              value={editDuration}
              onChange={setEditDuration}
              allowUnlimited={!subscription.is_installment}
            />
          </View>
          )}

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
              inputAccessoryViewID={KEYBOARD_DONE_ID}
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
        </ScrollView>
      </KeyboardAvoidingView>
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

  editScrollContent: {
    paddingHorizontal: Spacing.xl,
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
  colorChipLight: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
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
  cycleRow: { flexDirection: "row", gap: Spacing.sm },
  cycleBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cycleBtnActive: { backgroundColor: colors.primaryFixed, borderColor: colors.primary },
  cycleBtnText: { ...Typography.labelMd, fontWeight: "700", color: colors.onSurfaceVariant },
  cycleBtnTextActive: { color: colors.primary, fontWeight: "800" },
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
