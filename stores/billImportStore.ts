import { Category } from "@/constants/categories";
import { supabase } from "@/lib/supabase";
import { create } from "zustand";

const DEFAULT_IMPORT_DOMAIN = "import.subtification.app";
const IMPORT_MAILBOX = process.env.EXPO_PUBLIC_BILL_IMPORT_MAILBOX;

export type BillImportAddress = {
  id: string;
  user_id: string;
  local_part: string;
  is_active: boolean;
  created_at: string;
};

export type DetectedBillStatus = "pending" | "imported" | "ignored";

export type DetectedBill = {
  id: string;
  user_id: string;
  source_message_id: string;
  provider_key?: string;
  service_name: string;
  amount: number;
  currency: string;
  due_date?: string;
  billing_cycle: "monthly" | "yearly" | "weekly" | "quarterly";
  category: Category;
  status: DetectedBillStatus;
  confidence: number;
  sender_email?: string;
  raw_subject?: string;
  received_at?: string;
  created_at: string;
};

type BillImportState = {
  importAddress: BillImportAddress | null;
  detectedBills: DetectedBill[];
  loading: boolean;
  setupError: string | null;
  fetchImportAddress: () => Promise<BillImportAddress | null>;
  ensureImportAddress: () => Promise<BillImportAddress>;
  fetchDetectedBills: () => Promise<void>;
  markBillStatus: (id: string, status: DetectedBillStatus) => Promise<void>;
};

export const getBillImportDomain = () =>
  process.env.EXPO_PUBLIC_BILL_IMPORT_DOMAIN || DEFAULT_IMPORT_DOMAIN;

export const formatBillImportAddress = (address: BillImportAddress | null) => {
  if (!address) return "";
  if (IMPORT_MAILBOX?.includes("@")) {
    const [name, domain] = IMPORT_MAILBOX.split("@");
    return `${name}+${address.local_part}@${domain}`;
  }
  return `${address.local_part}@${getBillImportDomain()}`;
};

export const useBillImportStore = create<BillImportState>((set, get) => ({
  importAddress: null,
  detectedBills: [],
  loading: false,
  setupError: null,

  fetchImportAddress: async () => {
    set({ loading: true, setupError: null });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("email_import_addresses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      set({ importAddress: data ?? null });
      return data ?? null;
    } catch (error: any) {
      set({ setupError: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  ensureImportAddress: async () => {
    const existing = await get().fetchImportAddress();
    if (existing) return existing;

    set({ loading: true, setupError: null });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const localPart = createLocalPart(user.id);
      const { data, error } = await supabase
        .from("email_import_addresses")
        .insert({
          user_id: user.id,
          local_part: localPart,
        })
        .select("*")
        .single();

      if (error) throw error;
      set({ importAddress: data });
      return data;
    } catch (error: any) {
      set({ setupError: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchDetectedBills: async () => {
    set({ loading: true, setupError: null });
    try {
      const { data, error } = await supabase
        .from("detected_bills")
        .select("*")
        .in("status", ["pending", "imported"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      set({ detectedBills: (data ?? []) as DetectedBill[] });
    } catch (error: any) {
      set({ setupError: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  markBillStatus: async (id, status) => {
    set({ loading: true, setupError: null });
    try {
      const { error } = await supabase
        .from("detected_bills")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      set((state) => ({
        detectedBills:
          status === "ignored"
            ? state.detectedBills.filter((bill) => bill.id !== id)
            : state.detectedBills.map((bill) =>
                bill.id === id ? { ...bill, status } : bill,
              ),
      }));
    } catch (error: any) {
      set({ setupError: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));

function createLocalPart(userId: string) {
  const userPrefix = userId.replace(/-/g, "").slice(0, 12).toLowerCase();
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `u_${userPrefix}_${timePart}_${randomPart}`;
}
