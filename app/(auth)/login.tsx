import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, FIELD_HEIGHT, InputTypography, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useAuthStore } from "@/stores/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signInWithEmail, loading } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("common.error"), t("auth.err_fill_all"));
      return;
    }
    try {
      await signInWithEmail(email, password);
    } catch (error: any) {
      Alert.alert(t("auth.login_failed"), error.message);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={colors.onSurface} />
      </TouchableOpacity>

      <ScrollView
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brandName}>Subtification</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("auth.login_title")}</Text>
          <Text style={styles.cardSubtitle}>{t("auth.login_guest_hint")}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.email").toLocaleUpperCase(i18n.language)}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.email_placeholder")}
              placeholderTextColor={colors.outline}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.password").toLocaleUpperCase(i18n.language)}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.password_placeholder")}
              placeholderTextColor={colors.outline}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>{t("auth.forgot_password")}</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primarySolid, colors.primarySolidContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>{t("auth.sign_in")}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>{t("auth.no_account") + " "}</Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLink}>{t("auth.sign_up_link")}</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.replace("/(app)/(home)")}
            activeOpacity={0.75}
          >
            <Text style={styles.guestButtonText}>
              {t("auth.continue_as_guest")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xxxl,
  },
  brandName: {
    ...Typography.displayMd,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xxxl,
    padding: Spacing.xxl,
    shadowColor: colors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardTitle: {
    ...Typography.headlineLg,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  cardSubtitle: {
    ...Typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    // lineHeight'sız yazı + sabit yükseklik: metin ortalanır, harf altları kesilmez
    height: FIELD_HEIGHT,
    paddingVertical: 0,
    ...InputTypography.bodyLg,
    color: colors.onSurface,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing.xl,
  },
  forgotPasswordText: {
    ...Typography.labelMd,
    color: colors.primary,
  },
  loginButton: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginButtonText: {
    ...Typography.labelLg,
    color: "#ffffff",
    fontWeight: "700",
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  registerText: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  registerLink: {
    ...Typography.labelLg,
    color: colors.primary,
  },
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: Spacing.md,
  },
  guestButtonText: {
    ...Typography.labelLg,
    color: colors.onSurfaceVariant,
  },
  backButton: {
    position: "absolute",
    top: 20, // Modal olduğu için çok yukarıda olmasına gerek yok
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
  },
});
