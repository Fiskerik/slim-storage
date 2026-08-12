import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const localesDir = path.join(root, "locales");
const english = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8")).strings;
const targetCodes = { "zh-Hant": "zh-TW", "pt-BR": "pt", no: "no" };
const terms = ["TrimSwipe", "Pro", "iCloud", "Live Photos", "App Store", "MB", "GB", "Meta", "Unity", "iOS"];
const keys = Object.keys(english).filter((key) =>
  /^(ui\.(home-|game-|automation-|stats-|theme-|session-|pool-|unit-|trim-detail-|focus-|scan-|weekday-|age-|quality-)|ui\.(include|connecting|advertising-privacy-copy|ad-mediation-copy|times-per-day|weekdays|weekends|trim-share|delete-share|estimated-short))/.test(key),
);

function cleanSource(value) {
  return String(value)
    .replaceAll("Â·", "·")
    .replaceAll("â€¦", "…")
    .replaceAll("â€“", "–")
    .replaceAll("â‰¥", "≥");
}

function protect(value) {
  let result = value;
  terms.forEach((term, index) => { result = result.replaceAll(term, `ZXTERM${index}ZX`); });
  result = result.replace(/\{\{[^}]+\}\}/g, (placeholder, index) => `ZXPLACE${index}ZX`);
  return result;
}

function restore(value, source) {
  const placeholders = [...String(source).matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
  return String(value)
    .replace(/ZXTERM\s*(\d+)\s*ZX/gi, (_, index) => terms[Number(index)] ?? "")
    .replace(/ZXPLACE\s*(\d+)\s*ZX/gi, (_, index) => placeholders[Number(index)] ? `{{${placeholders[Number(index)]}}}` : "");
}

async function translate(text, target) {
  const query = encodeURIComponent(protect(text));
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${query}`);
  if (!response.ok) throw new Error(`Translation failed (${response.status})`);
  const payload = await response.json();
  return restore((payload?.[0] ?? []).map((part) => part?.[0] ?? "").join(""), text);
}

function hasPlaceholders(source, value) {
  return [...String(source).matchAll(/\{\{([^}]+)\}\}/g)].every((match) => String(value).includes(`{{${match[1]}}}`));
}

async function translateEntry(source, target) {
  const clean = cleanSource(source);
  try {
    const parts = clean.split(/(\{\{[^}]+\}\})/g);
    if (parts.length === 1) return await translate(clean, target);
    const translatedParts = [];
    for (const part of parts) {
      translatedParts.push(/^\{\{[^}]+\}\}$/.test(part) || part.length === 0 ? part : await translate(part, target));
    }
    const result = translatedParts.join("");
    return hasPlaceholders(clean, result) ? result : clean;
  } catch {
    return clean;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

const files = fs.readdirSync(localesDir).filter((file) => file.endsWith(".json") && file !== "en.json" && file !== "zh-Hans.json");
for (const file of files) {
  const full = path.join(localesDir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  catalog.strings ??= {};
  const target = targetCodes[file.slice(0, -5)] ?? file.slice(0, -5);
  const pending = keys.filter((key) => {
    const current = catalog.strings[key];
    return current === english[key] || current === undefined || current === cleanSource(english[key]);
  });
  const translated = await mapWithConcurrency(pending, 8, (key) => translateEntry(english[key], target));
  pending.forEach((key, index) => { catalog.strings[key] = translated[index]; });
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Translated ${file} (${target})`);
}

// Keep the English source clean as well; this only normalizes the keys added for this pass.
const englishCatalog = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
for (const key of keys) englishCatalog.strings[key] = cleanSource(englishCatalog.strings[key]);
fs.writeFileSync(path.join(localesDir, "en.json"), JSON.stringify(englishCatalog, null, 2) + "\n", "utf8");
