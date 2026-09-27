import type { Subscription } from "@/stores/subscriptionStore";

type DurationFields = Pick<
  Subscription,
  "is_active" | "next_billing_date" | "duration_months" | "first_billing_date"
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

const scheduleStart = (sub: DurationFields) =>
  parseDateOnly(sub.first_billing_date ?? sub.next_billing_date);

/** Süreli değilse null; süreliyse son ödemenin tarihi */
export const getLastPaymentDate = (sub: DurationFields): Date | null => {
  if (!sub.duration_months) return null;
  return addMonths(scheduleStart(sub), sub.duration_months - 1);
};

/** Bugünden önce kalmış (ödenmiş sayılan) ödeme sayısı */
export const getPaidCount = (sub: DurationFields): number => {
  if (!sub.duration_months) return 0;
  const start = scheduleStart(sub);
  const today = startOfToday();
  let paid = 0;
  while (paid < sub.duration_months && addMonths(start, paid) < today) paid++;
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

/** Süreli kayıtlarda takvime göre sıradaki ödeme; bitmişse null */
export const getNextPaymentDate = (sub: DurationFields): Date | null => {
  if (!sub.duration_months) return parseDateOnly(sub.next_billing_date);
  const paid = getPaidCount(sub);
  if (paid >= sub.duration_months) return null;
  return addMonths(scheduleStart(sub), paid);
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

/** Ayın verilen günü için bir sonraki ödeme tarihi; gün bugün ya da geçmişse gelecek ay */
export const getNextBillingDateForDay = (day: number): string => {
  const today = startOfToday();
  let candidate = new Date(today.getFullYear(), today.getMonth(), 1);
  if (day <= today.getDate()) candidate = addMonths(candidate, 1);
  const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  candidate.setDate(Math.min(day, lastDay));
  return toDateOnly(candidate);
};
