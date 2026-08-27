# Subtification — Proje Handoff Dosyası

Bu dosya, "Subtification" abonelik takip uygulamasının mevcut durumunu, kararlarını ve eksik kısımlarını özetler. Başka bir Claude chatine bu dosyayı vererek kaldığın yerden devam edebilirsin.

---

## 📌 Proje Özeti

- **Uygulama adı:** Subtification
- **Konsept:** "The Digital Curator" — premium, editorial-inspired abonelik takip uygulaması
- **Stack:** Expo (Managed Workflow) + Expo Router + Zustand + Supabase

---

## 🏗️ Mimari Kararlar

| Konu           | Karar                                                              |
| -------------- | ------------------------------------------------------------------ |
| Framework      | Expo Managed Workflow (bitişte `expo prebuild` ile iOS'a alınacak) |
| Navigasyon     | **Expo Router** (dosya tabanlı, `app/` klasörü)                    |
| State Yönetimi | **Zustand** (Redux yerine, çok daha sade)                          |
| Backend        | **Supabase** (auth + veritabanı)                                   |
| Auth           | Supabase Auth — email/şifre + Google OAuth                         |
| Fontlar        | Manrope (headlines) + Inter (body/label)                           |

---

## 📁 Mevcut Klasör Yapısı

```
app/
├── _layout.tsx                        ✅ TAMAMLANDI — Auth guard + root layout
├── (auth)/
│   ├── _layout.tsx                    ✅ TAMAMLANDI
│   ├── login.tsx                      ✅ TAMAMLANDI
│   ├── register.tsx                   ✅ TAMAMLANDI
│   └── forgot-password.tsx            ✅ TAMAMLANDI
└── (app)/
    ├── _layout.tsx                    ✅ TAMAMLANDI — Tab bar (5 sekme)
    ├── index.tsx                      ✅ TAMAMLANDI — Dashboard
    ├── subscriptions/
    │   ├── index.tsx                  ✅ TAMAMLANDI — Liste + arama + filtre
    │   ├── [id].tsx                   ❌ EKSİK — Abonelik detay ekranı
    │   └── new.tsx                    ❌ EKSİK — Yeni abonelik ekle
    ├── analytics.tsx                  ❌ EKSİK — Analiz & raporlar
    └── settings.tsx                   ❌ EKSİK — Ayarlar

constants/
├── colors.ts                          ✅ TAMAMLANDI — Tüm design token renkleri
├── typography.ts                      ✅ TAMAMLANDI — Fonts, spacing, border radius
└── categories.ts                      ✅ TAMAMLANDI — Kategoriler + popüler servisler

lib/
└── supabase.ts                        ✅ TAMAMLANDI — Supabase client (AsyncStorage session)

stores/
├── authStore.ts                       ✅ TAMAMLANDI — Zustand auth store
└── subscriptionStore.ts               ✅ TAMAMLANDI — Zustand subscription store

components/                            ❌ EKSİK — Henüz hiç component yazılmadı
hooks/                                 ❌ EKSİK — Henüz hook yazılmadı
```

---

## ✅ Tamamlanan Dosyaların İçerikleri

### `constants/colors.ts`

Tasarım sistemindeki tüm renk token'ları TypeScript sabiti olarak tanımlı.
Ana renkler: `primary: '#0b7285'`, `primaryContainer: '#0e7490'`, `primarySolid: '#0b7285'`, `secondaryContainer: '#4c7dff'`

### `constants/typography.ts`

- `FontFamily` sabiti (Manrope + Inter varyantları)
- `Typography` StyleSheet objesi (displayLg → labelSm)
- `BorderRadius` sabiti (sm: 4, full: 9999)
- `Spacing` sabiti (xs: 4 → huge: 40)

### `constants/categories.ts`

- `Category` tip: `'entertainment' | 'finance' | 'productivity' | 'health' | 'education' | 'other'`
- `CATEGORIES` array: id, label, color
- `POPULAR_SERVICES` array: 15 popüler servis (Netflix, Spotify, vs.)
- `BILLING_CYCLES`: `'monthly' | 'yearly' | 'weekly' | 'quarterly'`

### `lib/supabase.ts`

```ts
// env değişkenleri: EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY
createClient(url, key, {
  auth: { storage: AsyncStorage, persistSession: true },
});
```

### `stores/authStore.ts`

Zustand store. Metodlar:

- `initialize()` — `onAuthStateChange` listener kurar, root layout'ta bir kez çağrılır
- `signInWithEmail(email, password)`
- `signUpWithEmail(email, password)`
- `signInWithGoogle()` — `redirectTo: 'subtification://auth/callback'`
- `signOut()`
- `resetPassword(email)`

### `stores/subscriptionStore.ts`

Zustand store. Metodlar:

- `fetchSubscriptions()` — Supabase'den çeker
- `addSubscription(sub)` — Supabase'e ekler, store'u günceller
- `updateSubscription(id, updates)`
- `deleteSubscription(id)`
- `toggleActive(id)`

Computed (fonksiyon olarak):

- `totalMonthly()` — Aktif aboneliklerin aylık toplamı (cycle'a göre normalize eder)
- `upcomingPayments()` — 30 gün içindeki ödemeler, tarihe göre sıralı
- `byCategory()` — Kategoriye göre gruplu toplam + öğeler

`Subscription` tipi:

```ts
{
  id: string
  user_id: string
  name: string
  amount: number
  billing_cycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly'
  next_billing_date: string  // ISO date string
  category: Category
  emoji: string
  color: string  // hex renk kodu
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

### `app/_layout.tsx`

- `useAuthStore().initialize()` çağırır
- Oturum yoksa → `/(auth)/login`
- Oturum varsa → `/(app)`

### `app/(app)/_layout.tsx`

5 tab: Home (index), List (subscriptions/index), **+ FAB** (subscriptions/new), Analytics, Settings.
FAB — ortadaki büyük mavi yuvarlak buton, `subscriptions/new`'e yönlendiriyor.
`fetchSubscriptions()` app başladığında bir kez çağrılıyor.

### `app/(auth)/login.tsx`

- Google ile giriş butonu (üstte)
- Apple ile giriş butonu (üstte)
- Email + şifre formu
- Şifremi unuttum linki → `forgot-password`
- Kayıt ol linki → `register`
- Tasarım: `surfaceContainerLowest` kart, `primary` gradient login butonu

### `app/(auth)/register.tsx`

Email + şifre + şifre tekrar formu. Supabase email confirmation uyarısı gösteriyor.

### `app/(auth)/forgot-password.tsx`

Email giriş → Supabase `resetPasswordForEmail` → başarı mesajı

### `app/(app)/index.tsx` (Dashboard)

- Header: avatar + brand adı + search/settings ikonları
- **Hero card:** gradient arka plan (`primary` → `primaryContainer`), toplam aylık harcama (büyük rakam), "next due" badge, budget progress bar, "Add Subscription" butonu
- **Distribution card:** donut görsel (CSS borderlı, native), kategori legend
- **Upcoming Payments:** yatay scroll, her kart: emoji ikon + tarih badge + isim + tutar
- **All Active:** dikey liste, her satır: emoji + isim + cycle + tutar
- Empty state: abonelik yokken gösterilir
- Pull-to-refresh desteği var

### `app/(app)/subscriptions/index.tsx` (Liste)

- Başlık + "+ Add" butonu
- Search input
- Status filter chips: All / Active / Paused
- Category filter chips: All + her kategori
- Özet satır: kaç abonelik + toplam tutar
- Abonelik kartları: emoji ikon + isim + kategori/cycle + tutar + paused badge
- Tap → `subscriptions/[id]`
- Pull-to-refresh desteği var

---

## ❌ Yapılması Gereken Ekranlar

### 1. `app/(app)/subscriptions/[id].tsx` — Abonelik Detay

Tasarım dosyası: `stitch/abonelik_detay/code.html`

İçermesi gerekenler:

- Geri butonu
- Büyük emoji + servis adı + aktif/pasif badge
- Tutar + billing cycle
- Sonraki ödeme tarihi (gün sayacı ile)
- Kategori etiketi
- Notlar alanı
- "Pause/Resume" toggle butonu
- "Edit" butonu (inline düzenleme veya ayrı modal)
- "Delete" butonu (confirm dialog ile)
- `useSubscriptionStore().updateSubscription`, `deleteSubscription`, `toggleActive` kullanılacak
- Silme sonrası `router.back()`

### 2. `app/(app)/subscriptions/new.tsx` — Yeni Abonelik Ekle

Tasarım dosyası: `stitch/yeni_abonelik_ekle/code.html`

İçermesi gerekenler:

- Geri butonu
- Popüler servisler grid'i (POPULAR_SERVICES'den — tap ile otomatik doldurur)
- Emoji seçici (ya da metin input)
- Servis adı input
- Tutar input (sayısal klavye)
- Billing cycle seçici (4 seçenek: monthly/yearly/weekly/quarterly)
- Kategori seçici (CATEGORIES'den)
- Renk seçici (hex veya preset)
- Sonraki ödeme tarihi (DateTimePicker veya manuel input)
- Notlar (opsiyonel textarea)
- "Save" butonu → `addSubscription()` → `router.back()`
- Loading state kayıt sırasında
- Validasyon: isim ve tutar zorunlu

### 3. `app/(app)/analytics.tsx` — Analiz & Raporlar

Tasarım dosyası: `stitch/analiz_ve_raporlar/code.html`

İçermesi gerekenler:

- Toplam aylık / yıllık harcama
- Kategori bazlı dağılım (bar chart veya pie chart — `victory-native` veya `react-native-chart-kit` önerilir)
- En pahalı abonelik
- Aylık trend (son 6 ay mock veya gerçek veri)
- Yıllık projeksiyon
- `useSubscriptionStore()` computed değerleri kullanılacak: `totalMonthly()`, `byCategory()`

### 4. `app/(app)/settings.tsx` — Ayarlar

Tasarım dosyası: `stitch/ayarlar_settings/code.html`

İçermesi gerekenler:

- Kullanıcı profil kartı (email, avatar)
- Bildirim ayarları (kaç gün önce hatırlatma — expo-notifications)
- Para birimi seçimi (şimdilik $ sabit olabilir)
- Dark mode toggle (opsiyonel)
- "Sign Out" butonu → `useAuthStore().signOut()`
- Uygulama versiyonu (opsiyonel)

---

## 🗄️ Supabase SQL Şeması (Henüz oluşturulmadı)

Supabase dashboard'unda çalıştırılacak SQL:

```sql
-- Subscriptions tablosu
create table subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(10, 2) not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly', 'weekly', 'quarterly')),
  next_billing_date date not null,
  category text not null check (category in ('entertainment', 'finance', 'productivity', 'health', 'education', 'other')),
  emoji text not null default '📦',
  color text not null default '#0b7285',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: Her kullanıcı sadece kendi aboneliklerini görebilir
alter table subscriptions enable row level security;

create policy "Users can manage their own subscriptions"
  on subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at otomatik güncelleme
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();
```

---

## 📦 Kurulacak Paketler

```bash
# Supabase
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage

# Zustand
npm install zustand

# Navigation & safe area
npx expo install expo-router react-native-safe-area-context react-native-screens

# Google Auth (Supabase OAuth için WebBrowser)
npx expo install expo-web-browser expo-auth-session

# Bildirimler (Settings ekranında kullanılacak)
npx expo install expo-notifications

# Grafik (Analytics ekranı için — birini seç)
npm install react-native-chart-kit
# veya
npm install victory-native
```

---

## 🔧 Ortam Değişkenleri

Projenin root'unda `.env` dosyası oluştur:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🎨 Tasarım Sistemi Özeti

**Uygulama adı:** The Ledger  
**Konsept:** "The Editorial Ledger" — premium dergi estetiği

**Ana Renkler:**

- `primary`: `#0b7285` — modern teal-blue, brand ve okunabilir vurgu rengi
- `primaryContainer`: `#0e7490` — canlı ama sakin gradient/kart eşlikçisi
- `primarySolid`: `#0b7285` — beyaz yazılı CTA ve dolu seçim yüzeyi
- `secondaryContainer`: `#4c7dff` — mavi destek vurgusu
- `surface`: `#fafcfc` — ferah nötr sayfa arkaplanı
- `surfaceContainerLowest`: `#ffffff` — kartlar
- `surfaceContainerLow`: `#f2f8f8` — input arkaplanı
- `onSurface`: `#191b22` — metin (siyah değil!)
- `onSurfaceVariant`: `#3f4a4d` — ikincil metin

**Temel Kurallar:**

1. **Çizgi yok** — kartlar border yerine arkaplan renk farkıyla ayrılır
2. **Gradient hero** — `linear-gradient(heroGradientStart → heroGradientEnd)` büyük kartlarda
3. **Glassmorphism** — header'larda `rgba(250,252,252,0.6)` + `backdropFilter: blur(24px)`
4. **Ambient shadow** — `shadowColor: onSurface, shadowOpacity: 0.06, shadowRadius: 32`
5. **Saf siyah yok** — tüm metinler `onSurface (#191b22)` kullanır

**Font Kullanımı:**

- `Manrope` — başlıklar, büyük sayılar, CTA butonları
- `Inter` — body, label, form elemanları

**Border Radius:**

- Büyük kartlar: `32px` (`BorderRadius.xxxl`)
- Küçük kartlar / inputlar: `12-16px`
- Chip / badge: `9999px` (`BorderRadius.full`)

---

## 🔗 Orijinal Tasarım Dosyaları

ZIP içindeki HTML ekran mockup'ları:

- `stitch/giri_yap_log_in/code.html` + `screen.png`
- `stitch/dashboard_genel_bak/code.html` + `screen.png`
- `stitch/abonelik_listesi/code.html` + `screen.png`
- `stitch/abonelik_detay/code.html` + `screen.png`
- `stitch/yeni_abonelik_ekle/code.html` + `screen.png`
- `stitch/analiz_ve_raporlar/code.html` + `screen.png`
- `stitch/ayarlar_settings/code.html` + `screen.png`
- `stitch/lumina_ledger/DESIGN.md` — tam tasarım sistemi dökümantasyonu

---

## 🚀 Devam İçin Öneri Sıra

1. **Supabase SQL şemasını oluştur** (yukarıdaki SQL'i çalıştır)
2. **`.env` dosyasını oluştur**
3. **`subscriptions/new.tsx`** — Yeni abonelik ekle (önce bunu yap, veri girişi olmadan test edilemez)
4. **`subscriptions/[id].tsx`** — Detay + düzenleme + silme
5. **`analytics.tsx`** — Grafikler
6. **`settings.tsx`** — Profil + sign out + bildirimler
7. **Google OAuth** akışını `expo-web-browser` ile tamamla
8. **`expo prebuild`** — iOS klasörünü oluştur ve Xcode'da test et

---

## ⚠️ Dikkat Edilecekler

- `Colors.tertiaryFixedDim` dashboard'da kullanılıyor ama `colors.ts`'e eklenmemiş olabilir — kontrol et, değeri `#3ce36a`
- Google OAuth için Supabase dashboard'unda Google provider'ı aktif edilmeli ve `theledger://auth/callback` redirect URL'i eklenmalı
- `expo-notifications` için `app.json`'a `permissions` eklenmeli
- Expo Router'da dinamik route `[id].tsx` olarak oluşturulmalı, `subscriptions/new.tsx` bundan önce gelmeli yoksa "new" bir id olarak parse edilebilir — Expo Router bunu handle ediyor ama dikkatli ol
