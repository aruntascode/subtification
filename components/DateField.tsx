import type { AppColors } from "@/constants/colors";
import { BorderRadius, FIELD_HEIGHT, Spacing } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { parseDateOnly, toDateOnly } from "@/lib/subscriptionDuration";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

/** Gün seçildikten sonra seçimin görünüp pencerenin kapanmasına kadar geçen süre */
const CLOSE_DELAY_MS = 180;

type Props = {
  /** 'YYYY-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
};

/**
 * Ödeme tarihi alanı. iOS'ta dokununca sistemin takvimi (UIDatePicker, inline)
 * kendi penceremizde yumuşak geçişle açılır, gün seçilince aynı geçişle kapanır.
 * (Kompakt seçicinin açılır takvimi gün seçilince kapanmıyor ve animasyonlu
 * kapatılamıyor.) Android'de sistemin tarih penceresi kullanılır.
 */
export default function DateField({ value, onChange, minimumDate }: Props) {
  const { i18n } = useTranslation();
  const { colors, darkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const date = parseDateOnly(value);

  const handlePress = () => {
    if (Platform.OS === "ios") {
      setOpen(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      minimumDate,
      onChange: (event, selected) => {
        if (event.type === "set" && selected) onChange(toDateOnly(selected));
      },
    });
  };

  return (
    <>
      <TouchableOpacity style={styles.field} activeOpacity={0.75} onPress={handlePress}>
        <Text style={styles.fieldText} numberOfLines={1} adjustsFontSizeToFit>
          {date.toLocaleDateString(i18n.language, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.onSurfaceVariant} />
      </TouchableOpacity>

      {Platform.OS === "ios" && (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            {/* Kartın içine dokunmak pencereyi kapatmasın */}
            <Pressable style={styles.card} onPress={() => {}}>
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                locale={i18n.language}
                themeVariant={darkMode ? "dark" : "light"}
                accentColor={colors.primary}
                minimumDate={minimumDate}
                onChange={(event, selected) => {
                  if (event.type !== "set" || !selected) return;
                  onChange(toDateOnly(selected));
                  setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    field: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: Spacing.sm,
      backgroundColor: colors.surfaceContainerHighest,
      borderRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.lg,
      height: FIELD_HEIGHT,
    },
    fieldText: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.onSurface,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      padding: Spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: 24,
      padding: Spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
  });
