import { create } from 'zustand';
import { clearAllPendingOps } from '@/lib/pendingOps';
import { getStoredSessionUser, supabase } from '@/lib/supabase';
import { clearCloudCache } from '@/stores/subscriptionStore';
import { Session, User } from '@supabase/supabase-js';

// Supabase'in gönderdiği doğrulama ve şifre sıfırlama maillerindeki linkler buraya
// düşer. Şifre değiştirme işlemi o sayfanın kendisinde tamamlanır; kullanıcı
// sonrasında "Subtification'ı Aç" butonuyla uygulamaya döner.
const EMAIL_REDIRECT_TO = 'https://subtification.aruntas.com/auth/callback/';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  loading: false,
  initialized: false,

  initialize: () => {
    // Token dolmuşken çevrimdışı açılışta session null gelir ama oturum cihazda
    // durur; kullanıcı ayarlarda misafir görünmesin diye kayıtlı oturuma bakılır.
    // Çıkışta ya da geçersiz oturumda supabase kaydı sildiği için yedek de null olur.
    // Sıra numarası: kayıt okunurken yeni bir olay geldiyse eski sonuç yazılmaz.
    let latest = 0;
    const applySession = (session: Session | null) => {
      const seq = ++latest;
      if (session) {
        set({ session, user: session.user, initialized: true });
        return;
      }
      void getStoredSessionUser().then((user) => {
        if (seq === latest) set({ session: null, user, initialized: true });
      });
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    supabase.auth.onAuthStateChange((_event, session) => applySession(session));
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUpWithEmail: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: EMAIL_REDIRECT_TO },
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },


  signOut: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signOut();
      // Cihazda önceki hesabın abonelik önbelleği kalmasın
      await clearCloudCache();
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteAccount: async () => {
    set({ loading: true });
    try {
      // Sunucudaki delete_own_account() yalnızca oturumdaki kullanıcıyı siler.
      // Abonelik kayıtları user_id üzerindeki cascade ile birlikte gider.
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      await clearCloudCache();
      await clearAllPendingOps();
      await supabase.auth.signOut();
    } finally {
      set({ loading: false });
    }
  },

  resetPassword: async (email: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: EMAIL_REDIRECT_TO,
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },
}));
