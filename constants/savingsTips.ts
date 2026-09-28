/**
 * Kullanıcının verisinden bağımsız, her zaman geçerli tasarruf ipuçları.
 * Analizler sayfasında veriden çıkan ipucunun yanında günlük dönüşümlü gösterilir.
 * Metinler locales'te `analytics.general_tips.<id>.title / desc` altında.
 */
export type GeneralSavingsTip = {
  id: string;
  /** Ionicons adı */
  icon: string;
  /**
   * Kullanıcının bu adlardan birini içeren aboneliği varsa ipucu öne alınır
   * (küçük harfle, içerir karşılaştırması)
   */
  relevantTo?: string[];
};

export const GENERAL_SAVINGS_TIPS: GeneralSavingsTip[] = [
  {
    id: "yearly_plan",
    icon: "calendar-outline",
    relevantTo: ["disney", "hbo", "max", "playstation", "s sport"],
  },
  {
    id: "share_plan",
    icon: "people-outline",
    relevantTo: ["spotify", "youtube", "apple music", "icloud"],
  },
  {
    id: "student",
    icon: "school-outline",
    relevantTo: ["spotify", "youtube", "apple music"],
  },
  {
    id: "store_vs_web",
    icon: "globe-outline",
    relevantTo: ["chatgpt", "claude", "youtube", "spotify"],
  },
  {
    id: "carrier_bundle",
    icon: "phone-portrait-outline",
    relevantTo: ["netflix", "disney", "exxen", "tod", "youtube", "spotify"],
  },
  {
    id: "rotate_streaming",
    icon: "repeat-outline",
    relevantTo: ["netflix", "disney", "hbo", "max", "exxen", "amazon", "tod"],
  },
  {
    id: "free_trial",
    icon: "alarm-outline",
  },
  {
    id: "annual_review",
    icon: "checkmark-done-outline",
  },
];

/** Yılın kaçıncı günü; ipuçlarını her gün döndürmek için */
const dayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Gösterilecek genel ipuçları: kullanıcının abonelikleriyle ilgili olanlar önce,
 * her iki grup da güne göre döndürülür; böylece ipucu her gün değişir.
 */
export const pickGeneralTips = (
  subscriptionNames: string[],
  count: number,
  today = new Date(),
): GeneralSavingsTip[] => {
  if (count <= 0) return [];
  const names = subscriptionNames.map((n) => n.toLocaleLowerCase("tr"));
  const isRelevant = (tip: GeneralSavingsTip) =>
    !!tip.relevantTo?.some((key) => names.some((name) => name.includes(key)));

  const rotate = <T,>(items: T[]) => {
    if (items.length === 0) return items;
    const offset = dayOfYear(today) % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };

  const relevant = rotate(GENERAL_SAVINGS_TIPS.filter(isRelevant));
  const others = rotate(GENERAL_SAVINGS_TIPS.filter((tip) => !isRelevant(tip)));
  return [...relevant, ...others].slice(0, count);
};
