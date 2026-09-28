import type { Subscription } from "@/stores/subscriptionStore";

type DurationFields = Pick<
  Subscription,
  | "is_active"
  | "next_billing_date"
  | "duration_months"
  | "first_billing_date"
  | "billing_cycle"
>;

/** 'YYYY-MM-DD' → yerel gece yarısı (UTC kayması olmasın diye elle parse) */
export const parseDateOnly = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const toDateOnly = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** Ay ekler; 31 Ocak + 1 ay → 28/29 Şubat (ay sonunu taşırmaz) */
export const addMonths = (date: Date, months: number): Date => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Takvim çapası: kullanıcının girdiği başlangıç tarihi (first_billing_date).
 * Eski kayıtlarda yoksa kayıtlı ödeme tarihi de aynı takvimin geçerli bir noktası.
 * Sonraki ödeme her zaman buradan hesaplanır; kayıtlı tarih hiç eskimez.
 */
export const getScheduleAnchor = (sub: DurationFields) =>
  parseDateOnly(sub.first_billing_date ?? sub.next_billing_date);

/**
 * Çapadan itibaren k'ıncı ödemenin tarihi. Her ödeme çapadan hesaplanır
 * (bir öncekinden değil), böylece 31'inde başlayan abonelik Şubat'ta 28'ine
 * düşse de Mart'ta 31'ine döner.
 */
export const getPaymentOccurrence = (sub: DurationFields, k: number): Date => {
  const anchor = getScheduleAnchor(sub);
  switch (sub.billing_cycle) {
    case "weekly":
      return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 7 * k);
    case "quarterly":
      return addMonths(anchor, 3 * k);
    case "yearly":
      return addMonths(anchor, 12 * k);
    case "monthly":
    default:
      return addMonths(anchor, k);
  }
};

/** Süreli değilse null; süreliyse son ödemenin tarihi */
export const getLastPaymentDate = (sub: DurationFields): Date | null => {
  if (!sub.duration_months) return null;
  return getPaymentOccurrence(sub, sub.duration_months - 1);
};

/**
 * Bugünden önce kalmış (ödenmiş sayılan) ödeme sayısı. Bugünkü ödeme henüz
 * çekilmemiş sayılır. Süreliyse süreyle sınırlıdır.
 */
export const getPaidCount = (sub: DurationFields): number => {
  const today = startOfToday();
  const limit = sub.duration_months ?? Number.POSITIVE_INFINITY;
  let paid = 0;
  while (paid < limit && getPaymentOccurrence(sub, paid) < today) paid++;
  return paid;
};

export const getRemainingCount = (sub: DurationFields): number | null =>
  sub.duration_months ? sub.duration_months - getPaidCount(sub) : null;

/** Süreli abonelik/taksit tüm ödemelerini tamamladı mı */
export const isFinished = (sub: DurationFields): boolean =>
  !!sub.duration_months && getPaidCount(sub) >= sub.duration_months;

/** Toplamlara, yaklaşan ödemelere ve bildirimlere dahil edilmeli mi */
export const isBilling = (sub: DurationFields): boolean =>
  sub.is_active && !isFinished(sub);

/**
 * Takvime göre sıradaki ödeme (bugün dahil); süreli kayıt bitmişse null.
 * Uygulamanın her yeri sonraki ödemeyi buradan okumalı, next_billing_date'ten değil.
 */
export const getNextPaymentDate = (sub: DurationFields): Date | null => {
  const paid = getPaidCount(sub);
  if (sub.duration_months && paid >= sub.duration_months) return null;
  return getPaymentOccurrence(sub, paid);
};

/** Sonraki ödemeye kaç gün var (bugün = 0); bitmişse null */
export const getDaysUntilNextPayment = (sub: DurationFields): number | null => {
  const next = getNextPaymentDate(sub);
  if (!next) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((next.getTime() - startOfToday().getTime()) / dayMs);
};

/** Liste kartları için kısa ilerleme metni: "3/12 taksit", "5 ay kaldı", "Tamamlandı" */
export const formatDurationProgress = (
  sub: DurationFields & Pick<Subscription, "is_installment">,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  if (!sub.duration_months) return null;
  if (isFinished(sub)) return t("duration.finished");
  if (sub.is_installment) {
    return t("duration.progress_installment", {
      paid: getPaidCount(sub),
      total: sub.duration_months,
    });
  }
  return t("duration.progress_months", { remaining: getRemainingCount(sub) });
};
