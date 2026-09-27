import { BillingCycle, Category } from "@/constants/categories";
import { syncSubscriptionNotifications } from "@/lib/notifications";
import { isBilling } from "@/lib/subscriptionDuration";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency?: string; // YENİ: Sisteme para birimini tanıtıyoruz (Soru işareti eski verilerin hata vermemesi için)
  billing_cycle: BillingCycle;
  category: Category;
  next_billing_date: string;
  emoji: string;
  color: string;
  is_active: boolean;
  notes?: string;
  /** Kaç ay sürecek; null/undefined = süresiz */
  duration_months?: number | null;
  /** Taksitli alım mı (süreli olmak zorunda) */
  is_installment?: boolean;
  /** Süreli kayıtlarda ilk ödemenin tarihi; kalan ay bu tarihten hesaplanır */
  first_billing_date?: string | null;
}

interface SubscriptionState {
  subscriptions: Subscription[];
  loading: boolean;
  initialized: boolean;
  fetchSubscriptions: () => Promise<void>;
  addSubscription: (
    sub: Omit<Subscription, "id" | "user_id" | "created_at" | "updated_at">,
  ) => Promise<void>;
  updateSubscription: (
    id: string,
    updates: Partial<Subscription>,
  ) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  totalMonthly: () => number;
  upcomingPayments: () => Subscription[];
  byCategory: () => {
    category: Category;
    total: number;
    items: Subscription[];
  }[];
}

const normalizeToMonthly = (amount: number, cycle: BillingCycle): number => {
  switch (cycle) {
    case "weekly":
      return amount * 4.333;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
  }
};

const LOCAL_SUBSCRIPTIONS_KEY = "guest_subscriptions";

const sortByNextBillingDate = (subscriptions: Subscription[]) =>
  [...subscriptions].sort(
    (a, b) =>
      new Date(a.next_billing_date).getTime() -
      new Date(b.next_billing_date).getTime(),
  );

const readLocalSubscriptions = async (): Promise<Subscription[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_SUBSCRIPTIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalSubscriptions = async (subscriptions: Subscription[]) => {
  await AsyncStorage.setItem(
    LOCAL_SUBSCRIPTIONS_KEY,
    JSON.stringify(subscriptions),
  );
};

const createLocalId = () =>
  `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

const uploadLocalSubscriptions = async (userId: string) => {
  const localSubscriptions = await readLocalSubscriptions();
  if (localSubscriptions.length === 0) return;

  const payload = localSubscriptions.map((subscription) => ({
    user_id: userId,
    name: subscription.name,
    amount: subscription.amount,
    currency: subscription.currency ?? "₺",
    billing_cycle: subscription.billing_cycle,
    category: subscription.category,
    next_billing_date: subscription.next_billing_date,
    emoji: subscription.emoji,
    color: subscription.color,
    is_active: subscription.is_active,
    notes: subscription.notes,
    duration_months: subscription.duration_months ?? null,
    is_installment: subscription.is_installment ?? false,
    first_billing_date: subscription.first_billing_date ?? null,
  }));

  const { error } = await supabase.from("subscriptions").insert(payload);
  if (error) throw error;

  await AsyncStorage.removeItem(LOCAL_SUBSCRIPTIONS_KEY);
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  loading: false,
  initialized: false,
  fetchSubscriptions: async () => {
    set({ loading: true });
    try {
      const user = await getCurrentUser();

      if (!user) {
        const subscriptions = sortByNextBillingDate(
          await readLocalSubscriptions(),
        );
        set({ subscriptions });
        await syncSubscriptionNotifications(subscriptions);
        return;
      }

      await uploadLocalSubscriptions(user.id);

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("next_billing_date", { ascending: true });
      if (error) throw error;
      const subscriptions = data ?? [];
      set({ subscriptions });
      await syncSubscriptionNotifications(subscriptions);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  addSubscription: async (sub) => {
    set({ loading: true });
    try {
      const user = await getCurrentUser();

      if (!user) {
        const nextSubscription: Subscription = {
          ...sub,
          id: createLocalId(),
        };
        let nextSubscriptions: Subscription[] = [];
        set((state) => {
          nextSubscriptions = sortByNextBillingDate([
            ...state.subscriptions,
            nextSubscription,
          ]);
          return { subscriptions: nextSubscriptions };
        });
        await writeLocalSubscriptions(nextSubscriptions);
        await syncSubscriptionNotifications(nextSubscriptions);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .insert({ ...sub, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      let nextSubscriptions: Subscription[] = [];
      set((state) => {
        nextSubscriptions = [...state.subscriptions, data];
        return { subscriptions: nextSubscriptions };
      });
      await syncSubscriptionNotifications(nextSubscriptions);
    } finally {
      set({ loading: false });
    }
  },

  updateSubscription: async (id, updates) => {
    set({ loading: true });
    try {
      const user = await getCurrentUser();

      if (!user) {
        let nextSubscriptions: Subscription[] = [];
        set((state) => {
          nextSubscriptions = sortByNextBillingDate(
            state.subscriptions.map((s) =>
              s.id === id ? { ...s, ...updates } : s,
            ),
          );
          return { subscriptions: nextSubscriptions };
        });
        await writeLocalSubscriptions(nextSubscriptions);
        await syncSubscriptionNotifications(nextSubscriptions);
        return;
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      let nextSubscriptions: Subscription[] = [];
      set((state) => {
        nextSubscriptions = state.subscriptions.map((s) =>
          s.id === id ? data : s,
        );
        return { subscriptions: nextSubscriptions };
      });
      await syncSubscriptionNotifications(nextSubscriptions);
    } finally {
      set({ loading: false });
    }
  },

  deleteSubscription: async (id) => {
    set({ loading: true });
    try {
      const user = await getCurrentUser();

      if (!user) {
        let nextSubscriptions: Subscription[] = [];
        set((state) => {
          nextSubscriptions = state.subscriptions.filter((s) => s.id !== id);
          return { subscriptions: nextSubscriptions };
        });
        await writeLocalSubscriptions(nextSubscriptions);
        await syncSubscriptionNotifications(nextSubscriptions);
        return;
      }

      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      let nextSubscriptions: Subscription[] = [];
      set((state) => {
        nextSubscriptions = state.subscriptions.filter((s) => s.id !== id);
        return { subscriptions: nextSubscriptions };
      });
      await syncSubscriptionNotifications(nextSubscriptions);
    } finally {
      set({ loading: false });
    }
  },

  toggleActive: async (id) => {
    const sub = get().subscriptions.find((s) => s.id === id);
    if (!sub) return;
    await get().updateSubscription(id, { is_active: !sub.is_active });
  },

  totalMonthly: () => {
    return get()
      .subscriptions.filter(isBilling)
      .reduce(
        (sum, s) => sum + normalizeToMonthly(s.amount, s.billing_cycle),
        0,
      );
  },

  upcomingPayments: () => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return get()
      .subscriptions.filter((s) => {
        if (!isBilling(s)) return false;
        const date = new Date(s.next_billing_date);
        return date >= now && date <= thirtyDays;
      })
      .sort(
        (a, b) =>
          new Date(a.next_billing_date).getTime() -
          new Date(b.next_billing_date).getTime(),
      );
  },

  byCategory: () => {
    const subs = get().subscriptions.filter(isBilling);
    const map = new Map<Category, { total: number; items: Subscription[] }>();
    for (const s of subs) {
      const entry = map.get(s.category) ?? { total: 0, items: [] };
      entry.total += normalizeToMonthly(s.amount, s.billing_cycle);
      entry.items.push(s);
      map.set(s.category, entry);
    }
    return Array.from(map.entries())
      .map(([category, { total, items }]) => ({ category, total, items }))
      .sort((a, b) => b.total - a.total);
  },
}));
