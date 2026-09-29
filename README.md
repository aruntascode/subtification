# Subtification

Abonelik ve taksitlerini tek yerden takip etmek için bir iOS uygulaması. Ne kadar
harcadığını, sıradaki ödemenin ne zaman olduğunu ve paranın nereye gittiğini gösterir.

## Özellikler

- **Abonelik ekleme:** popüler servisleri planlarıyla (aylık/yıllık fiyatlar) tek dokunuşla
  ekle, listede olmayanı elle oluştur ya da birden fazla servisi toplu ekle.
- **Taksit ve süreli abonelik:** kaç taksit ödendiği, kaç ay kaldığı ve son ödeme tarihi.
- **Ödeme takvimi:** ay sonuna denk gelen tarihler dahil doğru hesaplanan sonraki ödemeler,
  ana sayfada aylık özet ve takvim şeridi.
- **Çoklu para birimi:** ₺, $, €, £, ¥ ile kayıt; toplamlar güncel kurla TL'ye çevrilir.
- **Analiz:** kategori dağılımı, en pahalı abonelikler, yıllık projeksiyon, bütçe limiti
  ve tasarruf ipuçları.
- **Hatırlatmalar:** ödemeden bir gün önce bildirim.
- **Misafir modu:** hesap açmadan kullan; giriş yapınca verilerin buluta taşınır.
- **Çevrimdışı:** internet yokken de ekleme, düzenleme ve silme yapılabilir; bağlantı gelince hesaba aktarılır.
- Açık/koyu/sistem teması, Türkçe ve İngilizce arayüz, uygulama içinden hesap silme.

## Teknoloji

- [Expo](https://expo.dev) SDK 57 (dev client) + Expo Router
- Zustand (state), i18next (çeviri)
- [Supabase](https://supabase.com) (e-posta/şifre ile giriş + Postgres, RLS)
- Kurlar: [frankfurter.app](https://www.frankfurter.app)

## Kurulum

1. Bağımlılıkları kur:

   ```bash
   npm install
   ```

2. Proje kökünde `.env` oluştur:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

3. Supabase SQL Editor'da sırayla çalıştır:
   - `supabase/rebuild_backend_safe.sql` — tablo, RLS ve tetikleyiciler (mevcut veriyi silmez)
   - `supabase/migrations/*.sql`
   - `supabase/delete_account.sql` — uygulama içi hesap silme fonksiyonu

4. Uygulamayı çalıştır. Proje dev client kullanıyor; Expo Go ile açılmaz.

   ```bash
   eas build --profile development-simulator --platform ios
   npx expo start
   ```

   Yerelde derlemek için Xcode ve CocoaPods gerekir:

   ```bash
   npx expo run:ios
   ```

## Kontroller

```bash
npx tsc --noEmit
npx expo lint
```

## Proje yapısı

```
app/          Ekranlar (Expo Router): (auth) giriş akışı, (app) uygulama
components/   Ortak bileşenler, tab bar, ana sayfa kartları
constants/    Renkler, tipografi, kategoriler, popüler servisler ve fiyatları
hooks/        Tema ve para birimi hook'ları
lib/          Supabase istemcisi, ödeme takvimi, bildirimler
stores/       Zustand store'ları (auth, abonelik, kur, bütçe, tema)
locales/      tr.json, en.json
supabase/     SQL şeması ve migration'lar
web/          subtification.aruntas.com (gizlilik, destek, e-posta dönüş sayfası)
```

Geliştirme notları ve mimari kurallar için [CLAUDE.md](CLAUDE.md) dosyasına bak.
