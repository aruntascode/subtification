import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Subtification] Supabase env vars eksik!\n' +
    'Proje kökünde bir .env dosyası oluştur ve şu satırları ekle:\n\n' +
    'EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\n' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...\n\n' +
    'Değişiklik sonrası "expo start --clear" ile yeniden başlat.'
  );
}

// supabase-js'in varsayılan anahtarıyla aynı (değişirse kayıtlı oturumlar kaybolur);
// çevrimdışı oturum okumak için açıkça tutuluyor
const SESSION_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    storageKey: SESSION_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Cihazda kayıtlı oturumun kullanıcısı. Erişim token'ı dolmuşken çevrimdışı
 * getSession() yenileyemediği için null döner ama oturum silinmez; kullanıcı
 * hâlâ giriş yapmış sayılmalı.
 */
export async function getStoredSessionUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    return stored?.user ?? stored?.currentSession?.user ?? null;
  } catch {
    return null;
  }
}
