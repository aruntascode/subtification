import { StyleSheet } from 'react-native';

export const FontFamily = {
  manrope: 'Manrope',
  manropeBold: 'Manrope-Bold',
  manropeExtraBold: 'Manrope-ExtraBold',
  inter: 'Inter',
  interMedium: 'Inter-Medium',
  interSemiBold: 'Inter-SemiBold',
  interBold: 'Inter-Bold',
} as const;

export const Typography = StyleSheet.create({
  displayLg: {
    fontFamily: 'Manrope',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  displayMd: {
    fontFamily: 'Manrope',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  displaySm: {
    fontFamily: 'Manrope',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  headlineLg: {
    fontFamily: 'Manrope',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  headlineMd: {
    fontFamily: 'Manrope',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  headlineSm: {
    fontFamily: 'Manrope',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  labelLg: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMd: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSm: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;
