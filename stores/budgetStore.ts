import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const BUDGET_LIMIT_KEY = "budget_limit";

interface BudgetState {
  /** Aylık bütçe limiti; 0 = limit yok */
  limit: number;
  hydrated: boolean;
  /** Uygulama açılışında bir kez çağrılır; ekranlar tekrar okumaz */
  initializeBudget: () => Promise<void>;
  setLimit: (limit: number) => Promise<void>;
}

/**
 * Bütçe limiti eskiden her ekran açılışında AsyncStorage'dan okunuyordu;
 * okuma bitene kadar ekran "limit yok" hâliyle çizilip sonra sıçrıyordu.
 * Artık değer bellekte tutuluyor ve ekranlar ilk karede doğru değeri görüyor.
 */
export const useBudgetStore = create<BudgetState>((set) => ({
  limit: 0,
  hydrated: false,

  initializeBudget: async () => {
    try {
      const stored = await AsyncStorage.getItem(BUDGET_LIMIT_KEY);
      set({ limit: parseFloat(stored ?? "") || 0, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setLimit: async (limit) => {
    set({ limit });
    try {
      await AsyncStorage.setItem(BUDGET_LIMIT_KEY, limit.toString());
    } catch {}
  },
}));
