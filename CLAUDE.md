# Subtification — Proje Handoff Dosyası

Abonelik ve taksit takip uygulaması. Bu dosya mevcut durumu, mimari kararları ve
dikkat edilmesi gereken kuralları özetler; yeni bir oturum buradan devam edebilir.

---

## 📌 Özet

- **Stack:** Expo SDK 57 (dev client, CNG — `ios/` ve `android/` gitignore'da) + Expo Router + Zustand + Supabase
- **Dil:** i18next — `locales/tr.json`, `locales/en.json`; cihaz diline göre seçilir
- **Kod dili:** Yorumlar ve commit mesajları Türkçe
- **Bundle id:** `com.aruntas.subtification`, URL scheme: `subtification`
- **Web:** `web/` — `subtification.aruntas.com` (Cloudflare, `wrangler.jsonc`): gizlilik, destek ve e-posta doğrulama/şifre sıfırlama dönüş sayfası (`auth/callback`)

---

## 📁 Klasör Yapısı

```
app/
├── _layout.tsx                  Root: tema/bütçe/auth/onboarding hydrate, tek splash, AppTabBar
├── onboarding.tsx               İlk açılış: 3 tanıtım + bildirim izni + giriş/misafir seçimi
├── (auth)/                      Modal olarak açılır (login, register, forgot-password)
└── (app)/
    ├── _layout.tsx              Stack; userId/session değişince fetchSubscriptions()
    ├── (home)/index.tsx         Dashboard (aylık özet, takvim şeridi, taksit özeti, yaklaşanlar)
    ├── (home)/subscriptions-list.tsx  Dashboard'dan "tümü" listesi
    ├── subscriptions.tsx        Liste sekmesi: arama, filtre, kaydırma aksiyonları, toplu seçim
    ├── analytics.tsx            Analiz: dağılım, en pahalılar, döngüler, bütçe, tasarruf ipuçları
    ├── new.tsx                  Tekli ekleme (popüler servis + plan, ya da ?custom=true ile özel)
    ├── bulk-add.tsx             Toplu ekleme (servis seç → tutarları gözden geçir)
    ├── settings.tsx             Profil, dil, kurlar, bütçe, tema, bildirim, şifre, hesap silme
    ├── subscription/[id].tsx    Detay: duraklat/devam, sil, kalan taksit bilgisi
    └── subscription/edit/[id].tsx  Düzenleme (ayrı sayfa)

components/   AppTabBar (FAB + alt menü), DateField, DurationPicker, SubscriptionIcon,
              InfoLabel, KeyboardDoneBar, SubtificationSplash, home/* kartları
constants/    colors (açık+koyu palet), typography, categories (19 kategori),
              services (popüler servisler + planlar/fiyatlar), currencies, savingsTips
hooks/        useAppTheme, useCurrency (useTotalMonthly, useCategoryTotals)
lib/          supabase, subscriptionDuration, paymentSchedule, notifications, colorContrast
stores/       authStore, subscriptionStore, currencyStore, budgetStore, themeStore, onboardingStore
scripts/      render-brand-assets.swift (logo/ikon/splash PNG'lerini Inter Black ile üretir)
supabase/     rebuild_backend_safe.sql, delete_account.sql, migrations/
```

Tab bar: Ana sayfa, Liste, **+ FAB** (alt menü: popüler servis / toplu ekle / özel), Analiz.
Ayarlar sekme değil; header'dan açılır.

---

## 🧠 Temel Kurallar (bozmadan önce oku)

### Ödeme takvimi — `lib/subscriptionDuration.ts`, `lib/paymentSchedule.ts`
- **Çapa** = `first_billing_date ?? next_billing_date`. Her ödeme çapadan hesaplanır
  (`getPaymentOccurrence(sub, k)`), bir öncekinden değil: 31 Ocak → 28 Şub → 31 Mar.
- **Sonraki ödemeyi her yerde `getNextPaymentDate()` ile oku**, `next_billing_date`
  alanından değil; kayıtlı alan eskiyebilir.
- Bugünkü ödeme henüz ödenmemiş sayılır (`getPaidCount`).
- `isBilling(sub)` = aktif ve bitmemiş; toplamlar, yaklaşanlar ve bildirimler bunu kullanır.
- **Süre (`duration_months`) yalnızca aylık döngüde** kullanılır (yeni, düzenleme ve
  toplu ekleme ekranları bunu uygular). Taksit her zaman aylıktır ve süre zorunludur.
- Düzenlemede tarih, döngü **ve süre** değişmediyse eski çapa korunur; biri değiştiyse
  çapa formdaki tarih olur (önizleme ile kayıt tutarlı kalsın diye).

### Oturum ve veri kaynağı — `stores/subscriptionStore.ts`
- **Misafir modu:** giriş yapmadan kullanılabilir; veriler AsyncStorage `guest_subscriptions`.
  Giriş yapılınca yerel kayıtlar Supabase'e yüklenip yerelden silinir.
- `getCurrentUser()` **`getSession()` kullanır, `getUser()` değil.** `getUser()` sunucuya
  sorar; çevrimdışıyken null döner ve kullanıcı misafir sanılır → bulut kayıtları yerele
  yazılıp sonra tekrar yüklenir (çift kayıt). Token dolmuşken çevrimdışı `getSession()`
  da null döner; o durumda `getStoredSessionUser()` (lib/supabase.ts) kayıtlı oturumu okur.
- **Çevrimdışı önbellek:** giriş yapmış kullanıcının listesi `cloud_subscriptions_cache_<userId>`
  anahtarında tutulur; her başarılı çekiş ve bulut mutasyonundan sonra yazılır, çekiş
  başarısızsa gösterilir, ilk açılışta ağ beklenmeden gösterilir. Çıkış ve hesap silmede
  `clearCloudCache()` ile temizlenir. Çevrimdışı mutasyonlar kuyruğa alınmaz, hata verir.
- `authStore` da session null gelince kayıtlı oturumun kullanıcısını `user` olarak tutar
  (session null kalır). `(app)/_layout` session geri gelince listeyi yeniden çeker.
- `lib/supabase.ts` içindeki `storageKey`, supabase-js varsayılanıyla aynı formülle
  hesaplanır (`sb-<host ilk parça>-auth-token`); değiştirirsen herkes çıkış yapar.

### Para birimi — `stores/currencyStore.ts`, `hooks/useCurrency.ts`
- Her aboneliğin kendi `currency` sembolü var (₺ $ € £ ¥); **gösterim para birimi sabit ₺**.
- Kurlar frankfurter.app'ten, 1 saat önbellek; çevrimdışıyken son alınan kurlar, hiç
  yoksa `FALLBACK_RATES`.
- Tutar inputları `lib/amountInput.ts` → `sanitizeAmountInput` kullanır (en fazla 8 tam,
  2 ondalık basamak; eski `numeric(10,2)` tablolara da sığar).
- Toplamları `useTotalMonthly()` / `useCategoryTotals()` veya `convert()` ile hesapla.
  Store'daki `totalMonthly()` / `byCategory()` para birimi dönüştürmez.

### Bildirimler — `lib/notifications.ts`
- Ayarlardan açılır (`push_alerts_enabled`). Her abonelik için sıradaki 3 ödeme,
  ödemeden 1 gün önce 09:00'da (geçmişse aynı gün 09:00). iOS limiti yüzünden en yakın 60.
- Store'daki her değişiklikten sonra `syncSubscriptionNotifications()` hepsini yeniden kurar.
  Senkron ve iptal bir kuyrukta sırayla çalışır (eşzamanlı çağrı çift bildirim bırakıyordu);
  modül içinden `runSync`/`runCancel`'ı doğrudan çağır, kuyruğa tekrar sokma (kilitlenir).

### Açılış: splash ve onboarding — `app/_layout.tsx`, `components/SubtificationSplash.tsx`
- **Tek splash, her soğuk açılışta bir kez.** Kök layout'ta tek örnek; `(app)` layout'unda
  splash yok. İlk ekran hazır olana kadar (abonelikler yüklendi ya da onboarding'e gidildi)
  ve giriş animasyonu bitene kadar kalır; sonra kaybolur ve geri gelmez. zIndex 1000.
- Native splash (`expo-splash-screen`, `preventAutoHideAsync`) JS splash'in ilk karesiyle
  aynı: ortada "Sub." kartı. JS splash metinleri ölçünce native splash'i kapatır; nokta
  kaybolur, kart sola kayar, "tification." belirir. Ölçüm 1,2 sn'de gelmezse son hâl gösterilir.
- Kart ölçüleri (yükseklik 52, padding 12, radius 8, font 34) splash görseliyle birebir;
  birini değiştirirsen `swift scripts/render-brand-assets.swift assets/images` ile
  görselleri yeniden üret ve çıktıdaki genişliği `app.json` → `imageWidth`'e yaz.
- **Logo yazısı Inter Black, kırık beyaz (`colors.logoText` = `#f4f1ea`):** splash ve
  onboarding logosu `fontFamily: "Inter"`, `fontWeight: "900"`. SF Pro görseller içinde
  lisans gereği kullanılmıyor; Manrope'a da çevirme, marka görünümü bu.
- Animasyon bitişini Reanimated callback'ine (`runOnJS`) bağlama; web'de çağrılmıyor.
  JS zamanlayıcısı kullan. Shared value'lara `.set()` ile yaz (`.value =` lint'e takılır).
- **Onboarding** `onboarding_completed` bayrağıyla bir kez gösterilir. Güncellemeden önce
  giriş yapmış ya da misafir verisi olan kullanıcılar için otomatik tamamlanmış sayılır.
  Bildirim izni verilirse `push_alerts_enabled` da açılır.

### Tema ve bütçe
- `themeStore`: `system | light | dark`; `useAppTheme()` renkleri verir. Ekranlar
  `createStyles(colors, darkMode)` + `useMemo` desenini kullanır.
- `budgetStore`: aylık limit + açık/kapalı; root layout hydrate edene kadar ekran çizilmez.

---

## 🗄️ Supabase

- Şema: `supabase/rebuild_backend_safe.sql` (idempotent; tablo silmez) + `supabase/migrations/`.
- `subscriptions` tablosu ek kolonlar: `currency`, `duration_months` (1–120), `is_installment`,
  `first_billing_date`. `amount numeric(12,2)`. RLS: kullanıcı yalnızca kendi satırları.
- Hesap silme: `supabase/delete_account.sql` → `delete_own_account()` RPC (security definer,
  yalnızca `auth.uid()`); abonelikler cascade ile silinir.
- Auth: yalnızca e-posta/şifre (Google/Apple yok). E-posta linkleri
  `https://subtification.aruntas.com/auth/callback/` adresine döner.
- Ortam değişkenleri `.env` içinde (gitignore'da):
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

---

## 🔧 Build ve Kontrol

```bash
npx tsc --noEmit        # temiz olmalı
npx expo lint           # hatasız olmalı
npx expo start          # dev client ile
eas build --profile development-simulator --platform ios
```

- Yerel `npx expo run:ios` için CocoaPods gerekir. Makinede sistem Ruby 2.6 var; CocoaPods
  `gem install --user-install` ile `~/.gem/ruby/2.6.0/bin` altına kuruldu (PATH'e ekle,
  `LANG=en_US.UTF-8`). Xcode 26.6 simülatör hedefi için iOS 26.5 platformu
  (Xcode > Settings > Components) kurulu olmalı; yoksa build hedef bulamaz.
- Otomatik test altyapısı yok. Takvim mantığı saf fonksiyonlar olduğu için Node ile
  (`node --experimental-strip-types`) senaryo testi yapılabilir.

---

## ⚠️ Bilinen Açık Konular

- Çevrimdışı ekleme/düzenleme/silme kuyruğa alınmıyor, hata veriyor.
- Web (`expo start --web`) hedef değil: `app.json` → `web.output: "static"` iken sunucu
  tarafı render supabase oturumunda çöker; web'de denemek için geçici olarak `"single"` yap.

## ✍️ React Compiler Kuralları

- `npx expo lint` hatasız olmalı (yalnızca `i18n.use` stil uyarısı kalır).
- Reanimated shared value'larına `.set(...)` ile yaz, `.value =` kullanma.
- Jest (`Gesture.Pan()`) nesnelerini elle `useMemo`'ya sarma; derleyici memoize eder.
- `Animated.Value` için `useRef(...).current` değil `useState(() => new Animated.Value(0))`.

---

## 🎨 Tasarım Sistemi

"The Editorial Ledger" — premium dergi estetiği.

- **Logo:** splash'teki kart: teal (`#0e7490`) zemin, turkuaz (`#5ddce1`) 1pt kenarlık ve
  ışıma, kırık beyaz "Sub." (Inter Black). iOS ikonu telefonun görünümüne göre değişir
  (`app.json` → `ios.icon`): açık modda kırık beyaz (`#f4f1ea`) zemin + açık tema kartı
  (`icon.png`), koyu modda `#0f1113` zemin + ışıyan kart (`icon-dark.png`), bir de
  `icon-tinted.png`. Android ve favicon açık mod görünümünü kullanır. Tüm PNG'ler `scripts/render-brand-assets.swift` ile üretilir.
- **Renkler (açık):** `primary #0b7285`, `primaryContainer #0e7490`, `surface #fafcfc`,
  `surfaceContainerLowest #ffffff`, `onSurface #191b22`. Koyu palet `constants/colors.ts`'te.
- **Çizgi yok:** kartlar border yerine arkaplan tonu farkıyla ayrılır.
- **Saf siyah yok:** metin `onSurface`.
- **Gradient hero**, header'larda **blur** (`expo-blur`), yumuşak ambient gölge.
- **Fontlar:** Manrope (başlık, büyük sayılar, CTA) + Inter (gövde, form).
  `assets/fonts/` altında 400/600/700/800 kalınlıklar (+ logo için Inter Black 900) (OFL lisanslı, @expo-google-fonts
  kaynaklı); `app.json` → `expo-font` eklentisiyle build'e gömülür (runtime `useFonts` yok).
  Stilde aile adı (`"Manrope"`, `"Inter"`) + `fontWeight` kullan; iOS doğru dosyayı
  kalınlığa göre seçer. Yeni kalınlık gerekirse dosyayı ekle, app.json'a yaz, yeniden build al.
  Font değişiklikleri ancak yeni native build'de görünür.
- **Radius:** büyük kart 32, küçük kart/input 12–16, chip `BorderRadius.full`.
