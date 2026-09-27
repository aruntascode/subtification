/** Algılanan parlaklık (0-1). Geçersiz hex'te 0 döner (koyu varsayılır). */
const perceivedBrightness = (hex: string): number => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Beyaz gibi çok açık renkler; üstlerinde beyaz ikon görünmez */
export const isLightColor = (hex?: string): boolean =>
  !!hex && perceivedBrightness(hex) > 0.8;

/** Verilen arka plan üzerinde okunacak ikon rengi (saf siyah yerine onSurface) */
export const getIconColorOn = (hex?: string): string =>
  isLightColor(hex) ? "#191b22" : "#ffffff";
