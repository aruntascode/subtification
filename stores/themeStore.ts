import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const DARK_MODE_KEY = "dark_mode";

interface ThemeState {
  darkMode: boolean;
  initializeTheme: () => Promise<void>;
  setDarkMode: (enabled: boolean) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: false,
  initializeTheme: async () => {
    const stored = await AsyncStorage.getItem(DARK_MODE_KEY);
    if (stored) set({ darkMode: stored === "true" });
  },
  setDarkMode: async (enabled) => {
    await AsyncStorage.setItem(DARK_MODE_KEY, String(enabled));
    set({ darkMode: enabled });
  },
}));
