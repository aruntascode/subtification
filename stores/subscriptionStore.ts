import { BillingCycle, Category } from "@/constants/categories";
import { syncSubscriptionNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
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
}

interface SubscriptionState {
  subscriptions: Subscription[];
  loading: boolean;
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

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  loading: false,
  fetchSubscriptions: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("next_billing_date", { ascending: true });
      if (error) throw error;
      const subscriptions = data ?? [];
      set({ subscriptions });
      await syncSubscriptionNotifications(subscriptions);
    } finally {
      set({ loading: false });
    }
  },

  addSubscription: async (sub) => {
    set({ loading: true });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
      .subscriptions.filter((s) => s.is_active)
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
        if (!s.is_active) return false;
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
    const subs = get().subscriptions.filter((s) => s.is_active);
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
