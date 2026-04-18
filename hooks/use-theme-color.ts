import type { AppColors } from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof AppColors
) {
  const { colors, darkMode } = useAppTheme();
  const colorFromProps = darkMode ? props.dark : props.light;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return colors[colorName];
  }
}
