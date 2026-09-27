import { useAppTheme } from "@/hooks/useAppTheme";
import { useTranslation } from "react-i18next";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * iOS'ta sayı klavyesinde ve çok satırlı alanlarda dönüş tuşu olmadığı için
 * klavye kapanmaz. Bu, klavyenin üstüne iOS'un kendi inputAccessoryView'ı ile
 * "Bitti" çubuğu bağlar. Kök layout'ta bir kez render edilir; alanlar
 * `inputAccessoryViewID={KEYBOARD_DONE_ID}` ile bağlanır. Android'de gerek yok.
 */
export const KEYBOARD_DONE_ID = "keyboard-done-bar";

export function KeyboardDoneBar() {
  const { t } = useTranslation();
  const { colors, darkMode } = useAppTheme();

  if (Platform.OS !== "ios") return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View
        style={[
          styles.bar,
          {
            // iOS klavyesinin kendi zemin tonlarına yakın
            backgroundColor: darkMode ? "#2c2c2e" : "#f1f1f4",
            borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
          },
        ]}
      >
        <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={12}>
          <Text style={[styles.done, { color: colors.primary }]}>
            {t("common.done")}
          </Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  done: {
    fontSize: 17,
    fontWeight: "600",
  },
});
