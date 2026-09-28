import { Spacing } from "@/constants/typography";
import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from "@expo/vector-icons";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  label: string;
  /** ⓘ'ye basınca açılan sistem uyarısının başlığı ve metni */
  infoTitle: string;
  infoMessage: string;
};

/** Form etiketi + yanında açıklama gösteren küçük ⓘ butonu */
export default function InfoLabel({ label, infoTitle, infoMessage }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => Alert.alert(infoTitle, infoMessage)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={infoTitle}
      >
        <Ionicons name="information-circle-outline" size={14} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

// Formlardaki `label` stiliyle aynı (büyük harf, geniş aralık)
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
