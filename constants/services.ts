import type { Category } from "@/constants/categories";

export type ServicePlan = {
  /** Paket adı; aynı paketin aylık ve yıllık hâli aynı label'ı paylaşır */
  label: string;
  /** Döngü başına fiyat, form input'una doğrudan yazıldığı için string */
  price: string;
  /** Verilmezse aylık */
  cycle?: "monthly" | "yearly";
  /** TL dışı fiyatlanan planlar için para birimi sembolü */
  forceCurrency?: string;
};

export type PopularService = {
  name: string;
  /** MaterialIcons adı */
  icon: string;
  color: string;
  category: Category;
  plans: ServicePlan[];
};

/** Hızlı ekleme ve toplu ekleme ekranlarındaki popüler servisler (TL) */
export const TR_SERVICES: PopularService[] = [
  {
    name: "Netflix",
    icon: "play-circle-outline",
    color: "#E50914",
    category: "entertainment",
    plans: [
      { label: "Temel", price: "189.99" },
      { label: "Standart", price: "289.99" },
      { label: "Premium", price: "379.99" },
    ],
  },
  {
    name: "YouTube Premium",
    icon: "smart-display",
    color: "#FF0000",
    category: "entertainment",
    plans: [{ label: "Bireysel", price: "79.99" }],
  },
  {
    name: "Spotify",
    icon: "library-music",
    color: "#1DB954",
    category: "music",
    plans: [
      { label: "Bireysel", price: "99.00" },
      { label: "Öğrenci", price: "55.00" },
      { label: "Duo", price: "135.00" },
      { label: "Aile", price: "165.00" },
    ],
  },
  {
    name: "Amazon Prime",
    icon: "shopping-cart",
    color: "#00A8E1",
    category: "shopping",
    plans: [
      { label: "Prime", price: "69.90" },
      { label: "Prime + Reklamsız Video", price: "129.80" },
    ],
  },
  {
    name: "Disney+",
    icon: "movie-filter",
    color: "#113CCF",
    category: "entertainment",
    plans: [
      { label: "Reklamlı", price: "249.90" },
      { label: "Reklamsız", price: "449.90" },
      { label: "Reklamlı", price: "2499.00", cycle: "yearly" },
      { label: "Reklamsız", price: "4499.00", cycle: "yearly" },
    ],
  },
  {
    name: "HBO Max",
    icon: "live-tv",
    color: "#5822B4",
    category: "entertainment",
    plans: [
      { label: "Standart", price: "229.90" },
      { label: "Özel", price: "299.90" },
      { label: "Standart", price: "2299.00", cycle: "yearly" },
      { label: "Özel", price: "2999.00", cycle: "yearly" },
    ],
  },
  {
    name: "iCloud+",
    icon: "cloud-queue",
    color: "#3283f6",
    category: "cloud",
    plans: [
      { label: "50 GB", price: "49.99" },
      { label: "200 GB", price: "169.99" },
      { label: "2 TB", price: "549.99" },
      { label: "6 TB", price: "1699.99" },
      { label: "12 TB", price: "3399.99" },
    ],
  },
  {
    name: "Apple Music",
    icon: "music-note",
    color: "#FA243C",
    category: "music",
    plans: [{ label: "Bireysel", price: "89.99" }],
  },
  {
    name: "Exxen",
    icon: "tv",
    color: "#F2E82E",
    category: "entertainment",
    plans: [
      { label: "Reklamlı", price: "219.00" },
      { label: "Reklamsız", price: "309.00" },
    ],
  },
  {
    name: "TOD",
    icon: "sports-soccer",
    color: "#6D28D9",
    category: "entertainment",
    plans: [
      { label: "Spor Extra", price: "350.00" },
      { label: "Süper Lig", price: "1590.00" },
    ],
  },
  {
    name: "Xbox Game Pass",
    icon: "sports-esports",
    color: "#107C10",
    category: "gaming",
    plans: [
      { label: "Essential", price: "269.00" },
      { label: "Premium", price: "409.00" },
      { label: "PC Game Pass", price: "419.00" },
      { label: "Ultimate", price: "529.00" },
    ],
  },
  {
    name: "PlayStation Plus",
    icon: "videogame-asset",
    color: "#003791",
    category: "gaming",
    plans: [
      { label: "Essential", price: "400.00" },
      { label: "Extra", price: "600.00" },
      { label: "Deluxe", price: "710.00" },
      { label: "Essential", price: "2890.00", cycle: "yearly" },
      { label: "Extra", price: "4810.00", cycle: "yearly" },
      { label: "Deluxe", price: "5560.00", cycle: "yearly" },
    ],
  },
  {
    name: "S Sport Plus",
    icon: "sports",
    color: "#E30613",
    category: "entertainment",
    plans: [
      { label: "Standart", price: "399.00" },
      { label: "Standart", price: "2799.00", cycle: "yearly" },
    ],
  },
  {
    name: "ChatGPT",
    icon: "auto-awesome",
    color: "#10A37F",
    category: "productivity",
    plans: [
      { label: "Go", price: "249.99" },
      { label: "Plus", price: "999.99" },
    ],
  },
  {
    name: "Claude",
    icon: "psychology",
    color: "#D97757",
    category: "productivity",
    plans: [
      { label: "Pro", price: "999.99" },
      { label: "Pro", price: "11999.99", cycle: "yearly" },
      { label: "Max 5x", price: "6999.99" },
      { label: "Max 20x", price: "12999.99" },
    ],
  },
  {
    name: "Spor Salonu",
    icon: "fitness-center",
    color: "#FF5722",
    category: "health",
    plans: [],
  },
  {
    name: "Ev İnterneti",
    icon: "wifi",
    color: "#607D8B",
    category: "utilities",
    plans: [],
  },
];

/** Aynı paketin aylık/yıllık hâlini ayırt eden anahtar (plan çipleri ve seçim için) */
export const planKey = (plan: ServicePlan) => `${plan.label}|${plan.cycle ?? "monthly"}`;

export const planCycle = (plan: ServicePlan) => plan.cycle ?? "monthly";

/**
 * Aylık ödenen bir abonelik için aynı paketin yıllık hâli ve yıllık tasarruf.
 * Paket, kayıtlı tutarın servis listesindeki aylık fiyatla eşleşmesinden bulunur.
 */
export const findYearlyAlternative = (
  name: string,
  monthlyAmount: number,
): { plan: ServicePlan; yearlySavings: number } | null => {
  const service = TR_SERVICES.find(
    (s) => s.name.toLocaleLowerCase("tr") === name.trim().toLocaleLowerCase("tr"),
  );
  if (!service) return null;
  const monthlyPlan = service.plans.find(
    (p) => planCycle(p) === "monthly" && Math.abs(parseFloat(p.price) - monthlyAmount) < 0.01,
  );
  if (!monthlyPlan) return null;
  const yearlyPlan = service.plans.find(
    (p) => planCycle(p) === "yearly" && p.label === monthlyPlan.label,
  );
  if (!yearlyPlan) return null;
  const yearlySavings = monthlyAmount * 12 - parseFloat(yearlyPlan.price);
  return yearlySavings > 0 ? { plan: yearlyPlan, yearlySavings } : null;
};
