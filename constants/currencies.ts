export interface Currency {
  symbol: string; // ₺, $, €, £, ¥
  iso: string; // TRY, USD, EUR, GBP, JPY
  name: string;
}

export const CURRENCIES: Currency[] = [
  { symbol: "₺", iso: "TRY", name: "Turkish Lira" },
  { symbol: "$", iso: "USD", name: "US Dollar" },
  { symbol: "€", iso: "EUR", name: "Euro" },
  { symbol: "£", iso: "GBP", name: "British Pound" },
  { symbol: "¥", iso: "JPY", name: "Japanese Yen" },
];

/** Sembolden ISO koda: '₺' → 'TRY' */
export const SYMBOL_TO_ISO: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.symbol, c.iso]),
);

/** ISO koddan sembole: 'TRY' → '₺' */
export const ISO_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.iso, c.symbol]),
);

/** Sembolden para birimi nesnesine */
export const getCurrencyBySymbol = (symbol: string): Currency =>
  CURRENCIES.find((c) => c.symbol === symbol) ?? CURRENCIES[0];
