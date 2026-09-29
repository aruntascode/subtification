import type { AppColors } from "@/constants/colors";
import { useAppTheme } from "@/hooks/useAppTheme";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type SubtificationSplashProps = {
  /** İçerik hazır; giriş animasyonu bitince splash kaybolur */
  exiting?: boolean;
  onExitComplete?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Native splash görseliyle (assets/images/splash-icon.png) aynı ölçüler;
// değiştirirsen scripts/render-brand-assets.swift ile görseli yeniden üret.
const CARD_HEIGHT = 52;
const CARD_PADDING = 12;
const CARD_MIN_WIDTH = 78;
const TAIL_GAP = 6;
const INTRO_DELAY_MS = 150;
const INTRO_DURATION_MS = 620;
const HOLD_MS = 260;
const EXIT_DURATION_MS = 360;

// Logo yazısı Inter Black (build'e gömülü). Logo PNG'leri ve native splash görseli
// de aynı fontla üretiliyor; değiştirirsen geçişte yazı zıplar.
const LOGO_FONT_FAMILY = "Inter";
const LOGO_FONT_WEIGHT = "900" as const;

const cardWidthFor = (textWidth: number) =>
  Math.max(CARD_MIN_WIDTH, textWidth + CARD_PADDING * 2);

type Widths = { withDot: number; withoutDot: number; tail: number };

/**
 * Açılış animasyonu. İlk kare native splash'in aynısı: ekranın ortasında
 * "Sub." kartı. Ölçümler bitince native splash kapatılır; nokta kaybolur,
 * kart sola kayar ve "tification." belirir. Uygulama her açılışta bir kez gösterir.
 */
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

  const [widths, setWidths] = useState<Partial<Widths>>({});
  const [introDone, setIntroDone] = useState(false);
  // Ölçüm gelmezse (web'de onLayout bazen tetiklenmiyor) kelime işareti son hâliyle gösterilir
  const [measureFailed, setMeasureFailed] = useState(false);
  const progress = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const measured =
    widths.withDot !== undefined &&
    widths.withoutDot !== undefined &&
    widths.tail !== undefined;

  const measure = (key: keyof Widths) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWidths((prev) => (prev[key] === width ? prev : { ...prev, [key]: width }));
  };

  // Ölçüm bir sebeple gelmezse native splash kalmasın, ekran boş durmasın
  useEffect(() => {
    if (measured) return;
    const timeout = setTimeout(() => {
      progress.set(1);
      setMeasureFailed(true);
      setIntroDone(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 1200);
    return () => clearTimeout(timeout);
  }, [measured, progress]);

  useEffect(() => {
    if (!measured || measureFailed) return;
    // Ortadaki kart çizildikten sonra native splash'i kaldır; geçiş fark edilmez
    requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
    progress.set(
      withDelay(
        INTRO_DELAY_MS,
        withTiming(1, { duration: INTRO_DURATION_MS, easing: Easing.inOut(Easing.cubic) }),
      ),
    );
    // Bitişi animasyon callback'ine bağlama: web'de runOnJS callback'i çağrılmıyor
    const timeout = setTimeout(() => setIntroDone(true), INTRO_DELAY_MS + INTRO_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [measured, measureFailed, progress]);

  useEffect(() => {
    if (!exiting || !introDone) return;
    containerOpacity.set(
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: EXIT_DURATION_MS, easing: Easing.out(Easing.cubic) }),
      ),
    );
    const timeout = setTimeout(() => onExitComplete?.(), HOLD_MS + EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [containerOpacity, exiting, introDone, onExitComplete]);

  const fullWidth = cardWidthFor(widths.withDot ?? 0);
  const shortWidth = cardWidthFor(widths.withoutDot ?? 0);
  // Satır ortalandığında kartın merkezi, kartın genişliğinden bağımsız olarak
  // (boşluk + kuyruk) / 2 kadar soldadır; başta bu kadar sağa kaydırılır
  const startShift = (TAIL_GAP + (widths.tail ?? 0)) / 2;

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));
  const rowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [startShift, 0]) },
    ],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [fullWidth, shortWidth]),
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [1, 0], "clamp"),
  }));
  const tailStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], "clamp"),
    transform: [
      { translateX: interpolate(progress.value, [0.3, 1], [-24, 0], "clamp") },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={exiting && introDone ? "none" : "auto"}
      style={[styles.container, containerStyle, style]}
    >
      {/* Ölçüm için görünmez metinler */}
      <View style={styles.measureLayer} pointerEvents="none">
        <Text style={styles.cardText} onLayout={measure("withDot")}>
          Sub.
        </Text>
        <Text style={styles.cardText} onLayout={measure("withoutDot")}>
          Sub
        </Text>
        <Text style={styles.brandText} onLayout={measure("tail")}>
          tification.
        </Text>
      </View>

      <Animated.View
        style={[styles.wordmark, rowStyle, !measured && !measureFailed && styles.hidden]}
        accessibilityRole="image"
        accessibilityLabel="Subtification"
      >
        {/* Dış katman gölgeyi taşır; iOS'ta overflow: hidden gölgeyi keserdi */}
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardClip}>
            <Text style={styles.cardText} numberOfLines={1}>
              Sub
            </Text>
            <Animated.Text style={[styles.cardText, dotStyle]}>.</Animated.Text>
          </View>
        </Animated.View>

        <Animated.Text style={[styles.brandText, tailStyle]} numberOfLines={1}>
          tification.
        </Animated.Text>
      </Animated.View>
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
    },
    measureLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      flexDirection: "row",
      opacity: 0,
    },
    hidden: {
      opacity: 0,
    },
    wordmark: {
      flexDirection: "row",
      alignItems: "center",
    },
    card: {
      height: CARD_HEIGHT,
      backgroundColor: colors.primarySolid,
      borderWidth: 1,
      borderColor: darkMode ? colors.primaryFixedDim : colors.primarySolidContainer,
      borderRadius: 8,
      shadowColor: colors.primary,
      shadowOpacity: darkMode ? 0.24 : 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    cardClip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      // Kenarlık 1pt; yazı native görseldeki gibi dış kenardan 12pt içeride başlasın
      paddingLeft: CARD_PADDING - 1,
      overflow: "hidden",
      borderRadius: 7,
    },
    cardText: {
      color: colors.logoText,
      fontFamily: LOGO_FONT_FAMILY,
      fontSize: 34,
      fontWeight: LOGO_FONT_WEIGHT,
      letterSpacing: 0,
      lineHeight: 42,
    },
    brandText: {
      color: colors.primary,
      fontFamily: LOGO_FONT_FAMILY,
      fontSize: 34,
      fontWeight: LOGO_FONT_WEIGHT,
      letterSpacing: 0,
      lineHeight: 42,
      marginLeft: TAIL_GAP,
    },
  });
