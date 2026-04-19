import type { AppColors } from "@/constants/colors";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useEffect, useMemo } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type SubtificationSplashProps = {
  exiting?: boolean;
  onExitComplete?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SubtificationSplash({
  exiting = false,
  onExitComplete,
  style,
}: SubtificationSplashProps) {
  const { colors, darkMode } = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, darkMode),
    [colors, darkMode],
  );

  const reveal = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    reveal.value = withTiming(1, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal]);

  useEffect(() => {
    if (!exiting) {
      containerOpacity.value = withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    containerOpacity.value = withTiming(
      0,
      { duration: 360, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && onExitComplete) {
          runOnJS(onExitComplete)();
        }
      },
    );
  }, [containerOpacity, exiting, onExitComplete]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateX: interpolate(reveal.value, [0, 1], [-112, 0]) }],
  }));

  return (
    <Animated.View
      pointerEvents={exiting ? "none" : "auto"}
      style={[styles.container, containerStyle, style]}
    >
      <View style={styles.content}>
        <View style={styles.wordmark} accessibilityRole="image">
          <View style={styles.subCard}>
            <Text style={styles.subText}>Sub</Text>
          </View>

          <Animated.Text
            style={[styles.brandText, revealStyle]}
            numberOfLines={1}
          >
            tification.
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: AppColors, darkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: 24,
    },
    content: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    wordmark: {
      position: "relative",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      maxWidth: 292,
    },
    subCard: {
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
      minWidth: 78,
      height: 52,
      paddingHorizontal: 12,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: darkMode ? colors.primaryFixedDim : colors.primaryContainer,
      borderRadius: 8,
      shadowColor: colors.primary,
      shadowOpacity: darkMode ? 0.24 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    subText: {
      color: colors.onPrimary,
      fontFamily: "Manrope",
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 42,
    },
    brandText: {
      color: colors.primary,
      fontFamily: "Manrope",
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: 0,
      lineHeight: 42,
      marginLeft: 6,
      zIndex: 1,
    },
  });
