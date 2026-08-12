import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ar from "../locales/ar.json";
import cs from "../locales/cs.json";
import da from "../locales/da.json";
import de from "../locales/de.json";
import es from "../locales/es.json";
import fi from "../locales/fi.json";
import fr from "../locales/fr.json";
import hi from "../locales/hi.json";
import id from "../locales/id.json";
import it from "../locales/it.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import ms from "../locales/ms.json";
import nl from "../locales/nl.json";
import no from "../locales/no.json";
import pl from "../locales/pl.json";
import ptBR from "../locales/pt-BR.json";
import ru from "../locales/ru.json";
import sv from "../locales/sv.json";
import ta from "../locales/ta.json";
import th from "../locales/th.json";
import tr from "../locales/tr.json";
import uk from "../locales/uk.json";
import vi from "../locales/vi.json";
import zhHans from "../locales/zh-Hans.json";
import zhHant from "../locales/zh-Hant.json";

export const APP_LANGUAGES = [
  ["en", "English", "English"], ["zh-Hans", "简体中文", "Simplified Chinese"], ["es", "Español", "Spanish"], ["hi", "हिन्दी", "Hindi"], ["ar", "العربية", "Arabic"], ["pt-BR", "Português (Brasil)", "Brazilian Portuguese"], ["fr", "Français", "French"], ["de", "Deutsch", "German"], ["ja", "日本語", "Japanese"], ["ko", "한국어", "Korean"], ["ru", "Русский", "Russian"], ["id", "Bahasa Indonesia", "Indonesian"], ["tr", "Türkçe", "Turkish"], ["it", "Italiano", "Italian"], ["vi", "Tiếng Việt", "Vietnamese"], ["zh-Hant", "繁體中文", "Traditional Chinese"], ["cs", "Čeština", "Czech"], ["nl", "Nederlands", "Dutch"], ["fi", "Suomi", "Finnish"], ["ms", "Bahasa Melayu", "Malay"], ["no", "Norsk", "Norwegian"], ["pl", "Polski", "Polish"], ["sv", "Svenska", "Swedish"], ["th", "ไทย", "Thai"], ["uk", "Українська", "Ukrainian"], ["da", "Dansk", "Danish"], ["ta", "தமிழ்", "Tamil"],
] as const;
export type AppLanguage = typeof APP_LANGUAGES[number][0];
export const resources = { en, "zh-Hans": zhHans, es, hi, ar, "pt-BR": ptBR, fr, de, ja, ko, ru, id, tr, it, vi, "zh-Hant": zhHant, cs, nl, fi, ms, no, pl, sv, th, uk, da, ta } as const;

type CatalogValue = Record<string, unknown>;

/**
 * The generated catalogs keep the legacy `strings` object for tooling, while
 * the app uses flat keys such as `ui.choose-language`. Expose both the
 * flattened top-level keys and the structured keys to i18next. `keySeparator`
 * is disabled because the dots in `ui.*` are part of the key, not nesting.
 */
function flattenCatalog(value: CatalogValue, prefix = "", result: Record<string, unknown> = {}) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenCatalog(child as CatalogValue, fullKey, result);
      if (key === "strings") Object.assign(result, child);
    } else {
      result[fullKey] = child;
    }
  }
  return result;
}

const normalizedResources = Object.fromEntries(
  Object.entries(resources).map(([key, value]) => [key, { translation: flattenCatalog(value as CatalogValue) }]),
);

void i18n.use(initReactI18next).init({
  resources: normalizedResources,
  lng: "en",
  fallbackLng: "en",
  initImmediate: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  react: { useSuspense: false },
});
export const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
export default i18n;
