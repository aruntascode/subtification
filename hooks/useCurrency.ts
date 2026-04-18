import { useEffect } from 'react';
import { useCurrencyStore } from '@/stores/currencyStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { BillingCycle } from '@/constants/categories';

// subscriptionStore içindeki normalizeToMonthly'yi burada da kullanıyoruz
function normalizeToMonthly(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':    return amount * 4.333;
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'yearly':    return amount / 12;
  }
}

/**
 * Para birimi dönüştürme ve formatlama hook'u.
 *
 * Kullanım:
 *   const { fmt, convert, displayCurrency } = useCurrency();
 *   <Text>{fmt(sub.amount, sub.currency)}</Text>
 *   // sub.currency = '₺' veya '$' — otomatik olarak displayCurrency'ye çevirir
 */
export function useCurrency() {
  const { displayCurrency, format, convert, initialize, ratesLoading, ratesError } =
    useCurrencyStore();

  // İlk kullanımda kurları yükle (önbellekten veya API'den)
  useEffect(() => {
    initialize();
  }, []);

  /**
   * Aboneliğin tutarını gösterim para birimine çevirip formatla.
   * @param amount     Orijinal tutar
   * @param fromSymbol Orijinal para birimi sembolü ('₺', '$', '€', '£', '¥')
   *                   Verilmezse displayCurrency varsayılır (zaten dönüştürülmüş değerler için).
   */
  const fmt = (amount: number, fromSymbol?: string): string =>
    format(amount, fromSymbol ?? displayCurrency);

  /**
   * Zaten displayCurrency cinsinden olan bir sayıyı sadece formatla (dönüştürme yapma).
   * useTotalMonthly() gibi hesaplanmış değerler için kullan.
   */
  const fmtDisplay = (amount: number): string => {
    const isJPY = displayCurrency === '¥';
    const num = isJPY
      ? Math.round(amount).toLocaleString('tr-TR')
      : amount.toFixed(2);
    return `${displayCurrency}${num}`;
  };

  /**
   * Aboneliğin orijinal para birimi ile gösterim para birimi farklıysa
   * her ikisini birden gösterir: "$10.00 (₺385.20)"
   * Aynıysa sadece normal formatlar: "₺385.20"
   *
   * @param amount     Orijinal tutar
   * @param fromSymbol Orijinal para birimi sembolü ('$', '€', '₺', …)
   */
  const fmtWithOriginal = (amount: number, fromSymbol?: string): string => {
    const from = fromSymbol ?? displayCurrency;
    if (from === displayCurrency) return fmt(amount, from);

    // Orijinal tutarı formatla (JPY için tam sayı, diğerleri 2 ondalık)
    const isFromJPY = from === '¥';
    const originalNum = isFromJPY
      ? Math.round(amount).toLocaleString('tr-TR')
      : amount.toFixed(2);
    const originalStr = `${from}${originalNum}`;

    // Gösterim para birimine çevir
    const convertedStr = format(amount, from);

    return `${originalStr} (${convertedStr})`;
  };

  return {
    /** Dönüştür + formatla: fmt(15.49, '$') → '₺598.45' */
    fmt,
    /** Zaten display currency'deyse sadece formatla: fmtDisplay(598.45) → '₺598.45' */
    fmtDisplay,
    /**
     * Orijinal para birimi farklıysa her ikisini gösterir: "$10.00 (₺385.20)"
     * Aynıysa sadece normal: "₺385.20"
     */
    fmtWithOriginal,
    /** Ham dönüştürme: convert(15.49, '$') → 598.45 */
    convert,
    /** Şu an seçili gösterim para birimi sembolü, örn '₺' */
    displayCurrency,
    ratesLoading,
    ratesError,
  };
}

/**
 * Tüm aktif aboneliklerin aylık toplamını gösterim para biriminde hesaplar.
 * Abonelikler farklı para birimlerinde olsa bile doğru toplam verir.
 */
export function useTotalMonthly(): number {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const { convert, displayCurrency } = useCurrencyStore();

  return subscriptions
    .filter((s) => s.is_active)
    .reduce((sum, s) => {
      const monthly = normalizeToMonthly(s.amount, s.billing_cycle);
      return sum + convert(monthly, s.currency ?? '₺', displayCurrency);
    }, 0);
}

/**
 * Kategori bazlı toplamları gösterim para biriminde hesaplar.
 */
export function useCategoryTotals() {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const { convert, displayCurrency } = useCurrencyStore();

  const map = new Map<string, number>();
  for (const s of subscriptions.filter((sub) => sub.is_active)) {
    const monthly = normalizeToMonthly(s.amount, s.billing_cycle);
    const converted = convert(monthly, s.currency ?? '₺', displayCurrency);
    map.set(s.category, (map.get(s.category) ?? 0) + converted);
  }

  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}
