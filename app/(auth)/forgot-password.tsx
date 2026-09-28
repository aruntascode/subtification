import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { AppColors } from '@/constants/colors';
import { Typography, BorderRadius, Spacing } from '@/constants/typography';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAuthStore } from '@/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPassword, loading } = useAuthStore();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleReset = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.err_email'));
      return;
    }
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.brandName}>Subtification</Text>

        <View style={styles.card}>
          {sent ? (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={48} color={colors.tertiaryFixedDim} />
              </View>
              <Text style={styles.cardTitle}>{t('auth.forgot_title')}</Text>
              <Text style={styles.description}>
                {t('auth.reset_sent')}
              </Text>
              <TouchableOpacity
                style={styles.backToLogin}
                onPress={() => router.replace('/(auth)/login')}
              >
                <Text style={styles.backToLoginText}>{t('auth.back_to_login')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>{t('auth.forgot_title')}</Text>
              <Text style={styles.description}>
                {t('auth.forgot_subtitle')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.email').toLocaleUpperCase(i18n.language)}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.email_placeholder')}
                  placeholderTextColor={colors.outline}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <TouchableOpacity onPress={handleReset} disabled={loading} activeOpacity={0.9}>
                <LinearGradient
                  colors={[colors.primarySolid, colors.primarySolidContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.resetButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.resetButtonText}>{t('auth.send_reset')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: Spacing.xxl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    ...Typography.displayMd,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
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
  successContainer: { alignItems: 'center' },
  successIcon: { marginBottom: Spacing.lg },
  cardTitle: {
    ...Typography.headlineLg,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  inputGroup: { marginBottom: Spacing.xl },
  label: { ...Typography.labelSm, color: colors.onSurfaceVariant, marginBottom: Spacing.xs, marginLeft: 4 },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    ...Typography.bodyLg,
    color: colors.onSurface,
  },
  resetButton: {
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  resetButtonText: { ...Typography.labelLg, color: '#ffffff', fontWeight: '700' },
  backToLogin: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
  },
  backToLoginText: { ...Typography.labelLg, color: colors.primary },
});
