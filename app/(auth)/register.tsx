import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
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
// Colors'un eklendiğinden emin olun: import { Colors } from '@/constants/colors';

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signUpWithEmail, loading } = useAuthStore();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    try {
      await signUpWithEmail(email, password);
      Alert.alert(
        "Check your email",
        "We sent you a confirmation link. Please verify your email before signing in.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* SOL ÜST GERİ OKU (Login ile aynı hizada) */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={28} color={colors.onSurface} />
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brandName}>Subtification</Text>
          <Text style={styles.tagline}>Start tracking your subscriptions</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("auth.register_title")}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={colors.outline}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.outline}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Repeat your password"
              placeholderTextColor={colors.outline}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primarySolid, colors.primarySolidContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.registerButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.registerButtonText}>{t("auth.sign_up")}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t("auth.have_account") + " "}</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.loginLink}>{t("auth.sign_in_link")}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  header: { alignItems: "center", marginBottom: Spacing.xxxl },
  brandName: { ...Typography.displayMd, color: colors.primary },
  tagline: {
    ...Typography.bodyLg,
    color: colors.onSurfaceVariant,
    marginTop: Spacing.sm,
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
    marginBottom: Spacing.xxl,
  },
  inputGroup: { marginBottom: Spacing.lg },
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
    paddingVertical: 14,
    ...Typography.bodyLg,
    color: colors.onSurface,
  },
  registerButton: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  registerButtonText: {
    ...Typography.labelLg,
    color: "#ffffff",
    fontWeight: "700",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  loginText: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  loginLink: { ...Typography.labelLg, color: colors.primary },
  backButton: {
    position: "absolute",
    top: 20, // Login sayfasındakiyle birebir aynı yükseklik
    left: 20, // Login sayfasındakiyle birebir aynı sol boşluk
    zIndex: 10,
    padding: 8,
    backgroundColor: colors.surfaceContainerLow, // Eğer arkaplan istemiyorsanız 'transparent' yapabilirsiniz
    borderRadius: 20,
  },
});
