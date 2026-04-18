/**
 * SubscriptionIcon
 *
 * `emoji` alanında hem gerçek emoji ('🎵') hem de MaterialIcons adı
 * ('library-music') saklanabilir. Bu bileşen hangisi olduğunu otomatik
 * algılar ve doğru renderer'ı kullanır.
 *
 * Kullanım:
 *   <SubscriptionIcon value={sub.emoji} color={sub.color} size={48} />
 */

import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface Props {
  /** sub.emoji — MaterialIcons adı ya da unicode emoji */
  value: string;
  /** Arka plan rengi (hex). Verilmezse şeffaf. */
  bgColor?: string;
  /** Icon / emoji boyutu */
  size?: number;
  /** Kapsayıcı boyutu (genişlik & yükseklik). Verilmezse size * 2. */
  containerSize?: number;
  /** Kapsayıcı border radius */
  radius?: number;
  /** Ek kapsayıcı stili */
  style?: ViewStyle;
}

/**
 * Değerin MaterialIcons adı mı olduğunu anlar.
 * MaterialIcons adları: küçük harf, rakam, tire — ve en az bir harf içerir.
 * Emoji'ler unicode sembollerden oluşur, bu pattern'a uymaz.
 */
function isMaterialIconName(value: string): boolean {
  return /^[a-z][a-z0-9-_]*$/.test(value);
}

export default function SubscriptionIcon({
  value,
  bgColor,
  size = 24,
  containerSize,
  radius = 14,
  style,
}: Props) {
  const boxSize = containerSize ?? size * 2;

  return (
    <View
      style={[
        styles.container,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: radius,
          backgroundColor: bgColor ?? "transparent",
        },
        style,
      ]}
    >
      {isMaterialIconName(value) ? (
        <MaterialIcons
          name={value as React.ComponentProps<typeof MaterialIcons>["name"]}
          size={size}
          color="#ffffff"
        />
      ) : (
        <Text style={{ fontSize: size * 0.9, lineHeight: size * 1.1 }}>
          {value || "📦"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
