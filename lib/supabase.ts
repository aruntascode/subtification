import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
