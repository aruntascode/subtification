import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const BUDGET_LIMIT_KEY = "budget_limit";
const BUDGET_ENABLED_KEY = "budget_enabled";

interface BudgetState {
  /** Aylık bütçe limiti; 0 = limit girilmemiş */
  limit: number;
  /** Kullanıcı bütçe takibini açtı mı; kapalıyken limit saklanır ama uygulanmaz */
  enabled: boolean;
  hydrated: boolean;
  /** Uygulama açılışında bir kez çağrılır; ekranlar tekrar okumaz */
  initializeBudget: () => Promise<void>;
  setLimit: (limit: number) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

/**
 * Bütçe limiti eskiden her ekran açılışında AsyncStorage'dan okunuyordu;
 * okuma bitene kadar ekran "limit yok" hâliyle çizilip sonra sıçrıyordu.
 * Artık değer bellekte tutuluyor ve ekranlar ilk karede doğru değeri görüyor.
 */
export const useBudgetStore = create<BudgetState>((set) => ({
  limit: 0,
  enabled: false,
  hydrated: false,

  initializeBudget: async () => {
    try {
      const [storedLimit, storedEnabled] = await Promise.all([
        AsyncStorage.getItem(BUDGET_LIMIT_KEY),
        AsyncStorage.getItem(BUDGET_ENABLED_KEY),
      ]);
      const limit = parseFloat(storedLimit ?? "") || 0;
      set({
        limit,
        // Anahtar eklenmeden önce limit girmiş kullanıcılarda takip açık kalsın
        enabled: storedEnabled === null ? limit > 0 : storedEnabled === "true",
        hydrated: true,
      });
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

  setEnabled: async (enabled) => {
    set({ enabled });
    try {
      await AsyncStorage.setItem(BUDGET_ENABLED_KEY, String(enabled));
    } catch {}
  },
}));

/** Bütçe uyarısı gösterilmeli mi: takip açık, limit girilmiş ve aşılmış */
export const isOverBudget = (monthly: number, limit: number, enabled: boolean) =>
  enabled && limit > 0 && monthly > limit;
