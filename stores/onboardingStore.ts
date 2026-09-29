import { getStoredSessionUser } from "@/lib/supabase";
import { LOCAL_SUBSCRIPTIONS_KEY } from "@/stores/subscriptionStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";

interface OnboardingState {
  completed: boolean;
  /** Kayıt okundu mu; okunmadan yönlendirme yapılırsa onboarding bir an görünüp kaybolur */
  hydrated: boolean;
  /** Uygulama açılışında bir kez çağrılır */
  initializeOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  hydrated: false,

  initializeOnboarding: async () => {
    try {
      if ((await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)) === "true") {
        set({ completed: true, hydrated: true });
        return;
      }

      // Onboarding'den önceki sürümü kullananlar: giriş yapmışsa ya da misafir
      // olarak kayıt eklemişse tanıtımı tekrar gösterme
      const [user, guestRaw] = await Promise.all([
        getStoredSessionUser(),
        AsyncStorage.getItem(LOCAL_SUBSCRIPTIONS_KEY),
      ]);
      const hasGuestData = !!guestRaw && guestRaw !== "[]";
      const existingUser = !!user || hasGuestData;
      if (existingUser) {
        await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
      }
      set({ completed: existingUser, hydrated: true });
    } catch {
      // Okunamazsa kullanıcıyı onboarding'de kilitleme
      set({ completed: true, hydrated: true });
    }
  },

  completeOnboarding: async () => {
    set({ completed: true });
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, "true").catch(() => {});
  },
}));
