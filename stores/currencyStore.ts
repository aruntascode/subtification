import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { SYMBOL_TO_ISO } from '@/constants/currencies';

// ---------- sabitler ----------
const RATES_CACHE_KEY = 'subtification_rates_cache';
const DISPLAY_CURRENCY_KEY = 'subtification_display_currency';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

// Frankfurter API'sının döndüremeyeceği durumlarda kullanacağımız yedek kurlar (yaklaşık)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  TRY: 38.5,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154,
};

// ---------- tipler ----------
interface RatesCache {
  rates: Record<string, number>; // ISO kod → kaç USD eder (USD=1 bazında)
  timestamp: number;
}

interface CurrencyState {
  /** Kullanıcının görmek istediği para birimi sembolü (₺, $, €...) */
  displayCurrency: string;
  /** ISO → rate (USD bazında). Örn: TRY: 38.5 ise 1 USD = 38.5 TRY */
  rates: Record<string, number>;
  ratesLoading: boolean;
  ratesError: boolean;

  /** Başlangıçta AsyncStorage'dan yükler + gerekirse API'yi çeker */
  initialize: () => Promise<void>;
  /** Frankfurter'dan kur günceller (TTL'e göre önbellekler) */
  fetchRates: () => Promise<void>;

  /**
   * Miktar dönüştür.
   * @param amount     Kaynak miktar
   * @param fromSymbol Kaynağın para birimi sembolü ('₺', '$', …)
   * @param toSymbol   Hedef sembol — verilmezse displayCurrency kullanılır
   */
  convert: (amount: number, fromSymbol: string, toSymbol?: string) => number;

  /**
   * Dönüştür ve formatla: "₺1.250,50" benzeri string döner.
   */
  format: (amount: number, fromSymbol: string, toSymbol?: string) => string;
}

// ---------- yardımcı ----------
function rateOf(rates: Record<string, number>, iso: string): number {
  return rates[iso] ?? FALLBACK_RATES[iso] ?? 1;
}

// ---------- store ----------
export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  displayCurrency: '₺',
  rates: FALLBACK_RATES,
  ratesLoading: false,
  ratesError: false,

  initialize: async () => {
    // Görüntüleme para birimi her zaman ₺; eski sürümden kalan seçimi temizle
    set({ displayCurrency: '₺' });
    AsyncStorage.removeItem(DISPLAY_CURRENCY_KEY).catch(() => {});

    // Önbellekten kurları yükle (veya API'yi çek)
    try {
      const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
      if (raw) {
        const cache: RatesCache = JSON.parse(raw);
        if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
          set({ rates: cache.rates });
          return; // önbellek taze, API'ye gitme
        }
      }
    } catch {}

    // Önbellek yok ya da bayat → API'yi çek
    await get().fetchRates();
  },

  fetchRates: async () => {
    set({ ratesLoading: true, ratesError: false });
    try {
      const res = await fetch(
        'https://api.frankfurter.app/latest?from=USD&to=TRY,EUR,GBP,JPY'
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rates: Record<string, number> = {
        USD: 1,
        TRY: data.rates.TRY,
        EUR: data.rates.EUR,
        GBP: data.rates.GBP,
        JPY: data.rates.JPY,
      };

      set({ rates, ratesLoading: false });

      // Önbelleğe yaz
      const cache: RatesCache = { rates, timestamp: Date.now() };
      await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // API başarısız → yedek kurları kullan, hata bayrağını set et
      set({ rates: FALLBACK_RATES, ratesLoading: false, ratesError: true });
    }
  },

  convert: (amount, fromSymbol, toSymbol) => {
    const { rates, displayCurrency } = get();
    const target = toSymbol ?? displayCurrency;
    if (fromSymbol === target) return amount;

    const fromISO = SYMBOL_TO_ISO[fromSymbol] ?? 'USD';
    const toISO = SYMBOL_TO_ISO[target] ?? 'USD';

    // amount → USD → target
    const inUSD = amount / rateOf(rates, fromISO);
    return inUSD * rateOf(rates, toISO);
  },

  format: (amount, fromSymbol, toSymbol) => {
    const { convert, displayCurrency } = get();
    const target = toSymbol ?? displayCurrency;
    const converted = convert(amount, fromSymbol, target);

    // JPY gibi küçük ondalıklı para birimlerinde tam sayı göster
    const isNoDecimal = target === '¥';
    const num = isNoDecimal
      ? Math.round(converted).toLocaleString('tr-TR')
      : converted.toFixed(2);

    return `${target}${num}`;
  },
}));
