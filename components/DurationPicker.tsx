import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing, Typography } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KEYBOARD_DONE_ID } from "@/components/KeyboardDoneBar";

const PRESET_MONTHS = [3, 6, 9, 12, 18, 24, 36];
const MAX_MONTHS = 120;

type Props = {
  /** null = süresiz */
  value: number | null;
  onChange: (months: number | null) => void;
  /** Taksitte süresiz seçeneği gösterilmez */
  allowUnlimited?: boolean;
};

export default function DurationPicker({
  value,
  onChange,
  allowUnlimited = true,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [customMode, setCustomMode] = useState(
    value !== null && !PRESET_MONTHS.includes(value),
  );
  const [customText, setCustomText] = useState(
    value !== null && !PRESET_MONTHS.includes(value) ? String(value) : "",
  );

  const selectPreset = (months: number | null) => {
    setCustomMode(false);
    onChange(months);
  };

  const handleCustomChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    setCustomText(digits);
    const months = parseInt(digits, 10);
    onChange(months > 0 ? Math.min(months, MAX_MONTHS) : null);
  };

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        {allowUnlimited &&
          chip("unlimited", t("duration.unlimited"), !customMode && value === null, () =>
            selectPreset(null),
          )}
        {PRESET_MONTHS.map((months) =>
          chip(
            String(months),
            t("duration.months", { count: months }),
            !customMode && value === months,
            () => selectPreset(months),
          ),
        )}
        {chip("custom", t("duration.custom"), customMode, () => {
          setCustomMode(true);
          const months = parseInt(customText, 10);
          onChange(months > 0 ? months : null);
        })}
      </ScrollView>

      {customMode && (
        <TextInput
          inputAccessoryViewID={KEYBOARD_DONE_ID}
          style={styles.input}
          value={customText}
          onChangeText={handleCustomChange}
          placeholder={t("duration.custom_placeholder")}
          placeholderTextColor={colors.onSurfaceVariant + "80"}
          keyboardType="number-pad"
          maxLength={3}
          autoFocus
        />
      )}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    scroll: {
      marginHorizontal: -4,
    },
    chip: {
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      marginHorizontal: 4,
    },
    chipActive: {
      backgroundColor: colors.primarySolid,
    },
    chipText: {
      ...Typography.labelMd,
      color: colors.onSurfaceVariant,
    },
    chipTextActive: {
      color: "#ffffff",
      fontWeight: "700",
    },
    input: {
      marginTop: Spacing.md,
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Platform.OS === "ios" ? 16 : 14,
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
    },
  });
