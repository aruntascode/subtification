import type { BillingCycle } from "@/constants/categories";
import { getLastPaymentDate, parseDateOnly } from "@/lib/subscriptionDuration";
import type { Subscription } from "@/stores/subscriptionStore";

export type ScheduledPayment = {
  sub: Subscription;
  date: Date;
};

export const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Takvimin çıpası: süreli kayıtta ilk ödeme, değilse kayıtlı ödeme tarihi */
const anchorOf = (sub: Subscription) =>
  parseDateOnly(sub.first_billing_date ?? sub.next_billing_date);

/** Ödeme döngüsüne göre, çıpadan türetilen o aydaki ödeme tarihleri */
const cycleDatesInMonth = (
  cycle: BillingCycle,
  anchor: Date,
  year: number,
  month: number,
): Date[] => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const onAnchorDay = () => new Date(year, month, Math.min(anchor.getDate(), lastDay));
  const monthDiff =
    (year - anchor.getFullYear()) * 12 + (month - anchor.getMonth());

  switch (cycle) {
    case "monthly":
      return [onAnchorDay()];
    case "quarterly":
      return ((monthDiff % 3) + 3) % 3 === 0 ? [onAnchorDay()] : [];
    case "yearly":
      return ((monthDiff % 12) + 12) % 12 === 0 ? [onAnchorDay()] : [];
    case "weekly": {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, lastDay);
      const dayMs = 24 * 60 * 60 * 1000;
      const daysFromAnchor = Math.round(
        (monthStart.getTime() - anchor.getTime()) / dayMs,
      );
      // Ay başına denk gelen ya da ondan sonraki ilk haftalık ödemeden başla
      let step = Math.ceil(daysFromAnchor / 7);
      const dates: Date[] = [];
      for (;;) {
        const date = new Date(
          anchor.getFullYear(),
          anchor.getMonth(),
          anchor.getDate() + step * 7,
        );
        if (date > monthEnd) break;
        if (date >= monthStart) dates.push(date);
        step++;
      }
      return dates;
    }
  }
};

/**
 * Verilen aydaki tüm ödemeler, tarihe göre sıralı. Duraklatılmış abonelikler
 * dahil edilmez; kayıtlar takvim çapasından önce görünmez, süreli/taksitli
 * kayıtlar yalnızca kendi süreleri içinde görünür (bu ay biten bir taksitin ay
 * başındaki ödemesi hâlâ sayılır).
 */
export const getPaymentsInMonth = (
  subscriptions: Subscription[],
  year: number,
  month: number,
): ScheduledPayment[] => {
  const payments: ScheduledPayment[] = [];

  for (const sub of subscriptions) {
    if (!sub.is_active) continue;
    const anchor = anchorOf(sub);
    const lastPayment = getLastPaymentDate(sub);

    for (const date of cycleDatesInMonth(sub.billing_cycle, anchor, year, month)) {
      // Çapadan önceki tarihler takvimde yok: yeni eklenen abonelik geçmişte
      // ödenmiş gibi görünmesin
      if (date < anchor || (lastPayment && date > lastPayment)) continue;
      payments.push({ sub, date });
    }
  }

  return payments.sort((a, b) => a.date.getTime() - b.date.getTime());
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
