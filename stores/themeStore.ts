import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { create } from "zustand";

const THEME_MODE_KEY = "theme_mode";
/** Eski sürümdeki açma/kapama anahtarı; ilk açılışta theme_mode'a taşınır */
const LEGACY_DARK_MODE_KEY = "dark_mode";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  /** Şu an gerçekten karanlık mı çiziliyor (mode + sistem ayarından türetilir) */
  darkMode: boolean;
  /** Kayıtlı seçim okundu mu; okunmadan ekran çizilirse renk sıçrar */
  hydrated: boolean;
  initializeTheme: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "light" || value === "dark";

/**
 * Klavye, uyarı pencereleri ve sistem menüleri de aynı moda uysun diye
 * seçimi native tarafa da bildirir; "system"de zorlamayı kaldırır.
 */
const applyToNative = (mode: ThemeMode) => {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
};

const resolveDark = (mode: ThemeMode) =>
  mode === "system" ? Appearance.getColorScheme() === "dark" : mode === "dark";

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "system",
  // Kayıt okunmadan önce bile ilk kare sistem moduyla çizilsin
  darkMode: Appearance.getColorScheme() === "dark",
  hydrated: false,

  initializeTheme: async () => {
    let mode: ThemeMode = "system";
    try {
      const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (isThemeMode(stored)) {
        mode = stored;
      } else {
        const legacy = await AsyncStorage.getItem(LEGACY_DARK_MODE_KEY);
        if (legacy !== null) {
          mode = legacy === "true" ? "dark" : "light";
          await AsyncStorage.setItem(THEME_MODE_KEY, mode);
          await AsyncStorage.removeItem(LEGACY_DARK_MODE_KEY);
        }
      }
    } catch {}

    applyToNative(mode);
    set({ mode, darkMode: resolveDark(mode), hydrated: true });
  },

  setMode: async (mode) => {
    applyToNative(mode);
    set({ mode, darkMode: resolveDark(mode) });
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, mode);
    } catch {}
  },
}));

// Telefonun modu değişince (örn. akşam otomatik karanlık) uygulama anında uysun
Appearance.addChangeListener(({ colorScheme }) => {
  if (useThemeStore.getState().mode !== "system") return;
  useThemeStore.setState({ darkMode: colorScheme === "dark" });
});
