import type { AppColors } from "@/constants/colors";
import { BorderRadius, Spacing } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { parseDateOnly, toDateOnly } from "@/lib/subscriptionDuration";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
};

/**
 * Ödeme tarihi alanı. iOS'ta sistemin kompakt tarih seçicisi (dokununca takvim
 * açılır), Android'de sistemin tarih penceresi kullanılır.
 */
export default function DateField({ value, onChange, minimumDate }: Props) {
  const { i18n } = useTranslation();
  const { colors, darkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const date = parseDateOnly(value);

  if (Platform.OS === "ios") {
    return (
      <View style={styles.iosContainer}>
        <DateTimePicker
          value={date}
          mode="date"
          display="compact"
          locale={i18n.language}
          themeVariant={darkMode ? "dark" : "light"}
          accentColor={colors.primary}
          minimumDate={minimumDate}
          onChange={(_, selected) => {
            if (selected) onChange(toDateOnly(selected));
          }}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.androidField}
      activeOpacity={0.75}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: date,
          mode: "date",
          minimumDate,
          onChange: (event, selected) => {
            if (event.type === "set" && selected) onChange(toDateOnly(selected));
          },
        })
      }
    >
      <Text style={styles.androidText}>
        {date.toLocaleDateString(i18n.language, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </Text>
      <Ionicons name="calendar-outline" size={18} color={colors.onSurfaceVariant} />
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    // Kompakt seçici kendi hapını çizer; diğer inputlarla aynı yükseklikte hizala
    iosContainer: {
      minHeight: 52,
      justifyContent: "center",
      alignItems: "flex-start",
    },
    androidField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
    },
    androidText: {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
    },
  });
