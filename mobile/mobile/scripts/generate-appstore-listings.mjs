import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const metadataPath = path.join(root, "app-store-metadata.json");
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const args = new Set(process.argv.slice(2));
const refreshAll = args.has("--refresh-all");
const refreshDescription = args.has("--refresh-description");
const refreshPromotionalText = args.has("--refresh-promotional-text");
const existingListings = new Map((metadata.localizedListings ?? []).map((listing) => [listing.locale, listing]));
const targets = { "en-US": "en", "en-GB": "en", "en-AU": "en", "en-CA": "en", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "pt-BR": "pt" };
const localeNames = { "en-US": "English (US)", "en-GB": "English (UK)", "en-AU": "English (Australia)", "en-CA": "English (Canada)", "zh-Hans": "简体中文", es: "Español", hi: "हिन्दी", ar: "العربية", "pt-BR": "Português (Brasil)", fr: "Français", de: "Deutsch", ja: "日本語", ko: "한국어", ru: "Русский", id: "Bahasa Indonesia", tr: "Türkçe", it: "Italiano", vi: "Tiếng Việt", "zh-Hant": "繁體中文", cs: "Čeština", nl: "Nederlands", fi: "Suomi", ms: "Bahasa Melayu", no: "Norsk", pl: "Polski", sv: "Svenska", th: "ไทย", uk: "Українська", da: "Dansk", ta: "தமிழ்" };
const terms = ["TrimSwipe", "Pro", "iCloud", "Live Photos", "App Store", "MB", "GB"];
const protect = (value) => terms.reduce((result, term, index) => result.replaceAll(term, `ZXTERM${index}ZX`), value);
const restore = (value) => value.replace(/ZXTERM(\d+)ZX/g, (_, index) => terms[Number(index)] ?? "");
async function translate(value, target) {
  if (target === "en") return value;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(protect(value))}`;
  const response = await fetch(url);
  if (!response.ok) return value;
  const payload = await response.json();
  return restore((payload?.[0] ?? []).map((part) => part?.[0] ?? "").join("")) || value;
}
const fields = ["subtitle", "description", "keywords", "reviewNotes", "releaseNotes"];
const chars = (value, max) => [...value].slice(0, max).join("");
const keywordBytes = (value, max) => {
  const tokens = value
    .replace(/[，、،]/g, ",")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const selected = [];
  for (const token of tokens) {
    const candidate = [...selected, token].join(",");
    if (Buffer.byteLength(candidate, "utf8") <= max) selected.push(token);
  }
  return selected.join(",");
};
metadata.locales = metadata.locales.map((locale) => ({ ...locale, language: localeNames[locale.id] ?? locale.language }));
const listings = await Promise.all(metadata.locales.map(async (locale) => {
  const target = targets[locale.id] ?? locale.id;
  const existing = existingListings.get(locale.id);
  const translated = Object.fromEntries(await Promise.all(fields.map(async (field) => {
    const shouldRefresh = refreshAll || (field === "description" && refreshDescription) || field === "keywords" || field === "releaseNotes" || !existing?.[field];
    return [field, shouldRefresh ? await translate(metadata.template[field], target) : existing[field]];
  })));
  const promotionalText = metadata.promotionalTextOverrides?.[locale.id] ?? (refreshPromotionalText || !existing?.promotionalText
    ? await translate(metadata.promotionalTextTranslationSource ?? metadata.template.promotionalText, target)
    : existing.promotionalText);
  const keywords = metadata.keywordOverrides?.[locale.id] ?? translated.keywords;
  return { locale: locale.id, language: localeNames[locale.id] ?? locale.language, name: metadata.template.name, subtitle: chars(translated.subtitle, 30), promotionalText: chars(promotionalText, 170), description: chars(translated.description, 4000), keywords: keywordBytes(keywords, 100), reviewNotes: translated.reviewNotes, releaseNotes: translated.releaseNotes, screenshots: metadata.sharedScreenshotPaths };
}));
metadata.localizedListings = listings;
metadata.productLocalizations = metadata.products.map((product) => ({ productId: product, localizations: metadata.locales.map((locale) => ({ locale: locale.id, displayName: product === "monthly" ? "TrimSwipe Pro Monthly" : product === "yearly" ? "TrimSwipe Pro Yearly" : product === "lifetime" ? "TrimSwipe Pro Lifetime" : `Trim Tokens ${product.replace("tokens-", "")}`, description: "Unlock a smoother photo cleanup workflow." })) }));
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
console.log(`Generated ${listings.length} localized App Store listings.`);
console.log(refreshPromotionalText
  ? "Promotional text was explicitly retranslated."
  : "Existing localized promotional text was preserved.");
