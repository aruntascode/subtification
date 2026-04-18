import { DarkColors, LightColors } from "@/constants/colors";
import { useThemeStore } from "@/stores/themeStore";
import { useMemo } from "react";

export function useAppTheme() {
  const darkMode = useThemeStore((state) => state.darkMode);

  return useMemo(
    () => ({
      darkMode,
      colors: darkMode ? DarkColors : LightColors,
      blurTint: darkMode ? ("dark" as const) : ("light" as const),
    }),
    [darkMode],
  );
}

export function useThemeColors() {
  return useAppTheme().colors;
}
