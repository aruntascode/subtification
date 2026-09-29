import { StyleSheet } from 'react-native';

// Yazı tipi belirtilmez: iOS sistem fontu SF Pro'yu (Android'de Roboto) fontWeight'e göre
// kullanır. Tek istisna logo ("Sub." kartı): Inter Black (SubtificationSplash, onboarding).
export const Typography = StyleSheet.create({
  displayLg: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  displayMd: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  displaySm: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  headlineLg: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  headlineMd: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  headlineSm: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  bodyLg: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMd: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySm: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  labelLg: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMd: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSm: {
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

/**
 * Tek satırlık form kutularının yüksekliği. Yan yana duran tutar ve tarih
 * alanları aynı boyda olsun diye iç boşluk yerine sabit yükseklik kullanılır
 * (iOS'ta TextInput ile Text aynı yazı boyutunda farklı yükseklik alabiliyor).
 */
export const FIELD_HEIGHT = 52;

/**
 * Tek satırlı TextInput için yazı stilleri: `lineHeight` yok. iOS'ta TextInput'a
 * lineHeight verilince metin aşağı kayar ve g/y/q gibi harflerin altı kesilir.
 * Yüksekliği `height` ile ver; iOS metni o yüksekliğin içinde dikeyde ortalar.
 */
const withoutLineHeight = <T extends { lineHeight?: number }>({ lineHeight: _lineHeight, ...rest }: T) => rest;

export const InputTypography = {
  bodyLg: withoutLineHeight(Typography.bodyLg),
};
