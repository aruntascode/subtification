import i18n from "@/locales/i18n";

/**
 * Tutar alanlarının üst sınırı: tam kısım en fazla 8 basamak, küsurat 2 basamak
 * (99.999.999,99). Supabase'de `amount numeric(10,2)` ile oluşturulmuş eski
 * tablolar da bunu kaldırır; daha büyük tutar kayıtta hata veriyordu.
 */
const MAX_WHOLE_DIGITS = 8;
const MAX_DECIMAL_DIGITS = 2;

/** Klavyeden gelen metni sayı girişine çevirir: virgül → nokta, harf yok, sınırlı basamak */
export const sanitizeAmountInput = (value: string) => {
  const normalized = value.replace(",", ".");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const digitsOnly = whole.replace(/\D/g, "").slice(0, MAX_WHOLE_DIGITS);
  const decimal = decimalParts
    .join("")
    .replace(/\D/g, "")
    .slice(0, MAX_DECIMAL_DIGITS);

  return decimalParts.length > 0 ? `${digitsOnly}.${decimal}` : digitsOnly;
};

/**
 * Tutarı uygulama diline göre binlik ayırıcıyla yazar:
 * TR "16.836,12", EN "16,836.12". Yen gibi küsuratsız para birimlerinde tam sayı.
 */
export const formatAmountNumber = (amount: number, noDecimals = false) => {
  const locale = i18n.language?.startsWith("tr") ? "tr-TR" : "en-US";
  const digits = noDecimals ? 0 : 2;
  return (noDecimals ? Math.round(amount) : amount).toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
