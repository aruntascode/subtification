import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import tr from "./tr.json";

// Telefonun dilini otomatik algıla
const getDeviceLang = () => {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const locale = locales[0].languageTag; // Örn: "tr-TR", "en-US"
      return locale.startsWith("tr") ? "tr" : "en";
    }
  } catch (error) {
    // Eğer dil bulunurken bir sorun çıkarsa sessizce yakala
    console.warn("Dil algılanamadı, varsayılan ayar (en) kullanılıyor.");
  }

  return "en"; // Bulamazsa veya hata olursa varsayılan İngilizce
};

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: getDeviceLang(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  initImmediate: false,
});

export default i18n;
