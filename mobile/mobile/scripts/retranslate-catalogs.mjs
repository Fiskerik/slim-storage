/**
 * Rebuild the translated catalogs from the English source without the lossy
 * multi-line marker parsing used by the first migration.  Each request keeps
 * entries in a bounded batch, preserves placeholders and product terms, and
 * falls back to the existing value if a translation cannot be validated.
 *
 * This intentionally talks only to Google Translate with public UI copy. It
 * never sends user data, photos, identifiers, or secrets.
 *
 * Usage:
 *   node scripts/retranslate-catalogs.mjs
 *   node scripts/retranslate-catalogs.mjs --locale=sv
 *   node scripts/retranslate-catalogs.mjs --missing-only
 *   node scripts/retranslate-catalogs.mjs --keys=ui.home,ui.settings
 *   node scripts/retranslate-catalogs.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const localesDir = path.join(root, "locales");
const args = new Set(process.argv.slice(2));
const localeArg = process.argv.find((value) => value.startsWith("--locale="))?.slice("--locale=".length);
const keyArg = process.argv.find((value) => value.startsWith("--keys="))?.slice("--keys=".length);
const dryRun = args.has("--dry-run");
const missingOnly = args.has("--missing-only");
const unexpectedNewlinesOnly = args.has("--unexpected-newlines-only");
const selectedKeys = new Set((keyArg ?? "").split(",").map((key) => key.trim()).filter(Boolean));
const targetCodes = { "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "pt-BR": "pt" };
const reviewedOverridesDir = path.join(root, "localization", "reviewed-overrides");

// Keep identifiers, product names, units and placeholder syntax untouched.
// Longest entries must come first so a shorter term cannot consume part of a
// longer protected one.
const protectedTerms = [
  "TrimSwipe Pro",
  "App Store Connect",
  "Apple Account",
  "Live Photos",
  "App Store",
  "TrimSwipe",
  "RevenueCat",
  "TestFlight",
  "iCloud",
  "AdMob",
  "iPhone",
  "iPad",
  "Apple",
  "iOS",
  "Pro",
  "HEIC",
  "JPEG",
  "JPG",
  "EXIF",
  "GPS",
  "Meta",
  "Unity",
  "EULA",
  "MB",
  "GB",
];

const sourceRepair = new Map([
  ["Â·", "·"],
  ["â€¦", "…"],
  ["â€“", "–"],
  ["â€”", "—"],
  ["â€™", "’"],
  ["â€œ", "“"],
  ["â€", "”"],
  ["â‰¥", "≥"],
  ["â‰¤", "≤"],
  ["ðŸ‘‹", "👋"],
  ["ðŸ”¥", "🔥"],
  ["âœ…", "✅"],
]);

function repairSource(value) {
  let repaired = String(value);
  for (const [broken, fixed] of sourceRepair) repaired = repaired.replaceAll(broken, fixed);
  return repaired;
}

const brokenEncoding = /(?:Ãƒ.|Ã‚.|Ã.|Ã‘.|Ã˜.|Ã™.|Ã Â¤|Ã Â¸|Ã Â®|Ã¢.|Ã¦.|Ã§.|Ã¯Â»Â¿)/;
function repairEncoding(value) {
  if (typeof value === "string" && brokenEncoding.test(value)) return Buffer.from(value, "latin1").toString("utf8");
  if (Array.isArray(value)) return value.map(repairEncoding);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, repairEncoding(child)]));
  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function leafEntries(value, prefix = "", result = []) {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isObject(child)) leafEntries(child, fullKey, result);
    else result.push([fullKey, child]);
  }
  return result;
}

function getAtPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), value);
}

function getCatalogValue(catalog, pathKey) {
  if (pathKey.startsWith("strings.")) return catalog.strings?.[pathKey.slice("strings.".length)];
  if (pathKey.startsWith("ui.")) return catalog.strings?.[pathKey];
  return getAtPath(catalog, pathKey);
}

function setCatalogValue(catalog, pathKey, value) {
  if (pathKey.startsWith("strings.")) {
    catalog.strings ??= {};
    catalog.strings[pathKey.slice("strings.".length)] = value;
    return;
  }
  if (pathKey.startsWith("ui.")) {
    catalog.strings ??= {};
    catalog.strings[pathKey] = value;
    return;
  }
  setAtPath(catalog, pathKey, value);
}

function setAtPath(value, dottedPath, next) {
  const keys = dottedPath.split(".");
  let current = value;
  for (const key of keys.slice(0, -1)) {
    if (!isObject(current[key])) current[key] = {};
    current = current[key];
  }
  current[keys.at(-1)] = next;
}

function isTechnicalEntry(key, value) {
  const source = String(value);
  return (
    key === "app.name" ||
    /^(?:strings\.)?ui\.(?:alignitems|backgroundcolor|borderradius|flexdirection|fontweight|gap-|height-|justifycontent|lineheight|margin|padding|textalign|texttransform|width)/.test(key) ||
    /(?:\b(?:alignItems|backgroundColor|borderRadius|flexDirection|fontSize|fontWeight|justifyContent|lineHeight|textAlign|textTransform)\b|settings\.[A-Za-z]+|styles\.[A-Za-z]+)/.test(source)
  );
}

function loadReviewedOverrides() {
  if (!fs.existsSync(reviewedOverridesDir)) return {};
  const combined = {};
  for (const file of fs.readdirSync(reviewedOverridesDir).filter((name) => name.endsWith(".json"))) {
    const parsed = repairEncoding(JSON.parse(fs.readFileSync(path.join(reviewedOverridesDir, file), "utf8")));
    for (const [locale, entries] of Object.entries(parsed)) {
      if (!isObject(entries)) throw new Error(`${file}: ${locale} must contain a key/value object`);
      combined[locale] = { ...(combined[locale] ?? {}), ...entries };
    }
  }
  return combined;
}

function protect(value) {
  const replacements = [];
  let result = value;
  for (const term of protectedTerms) {
    const token = `ZZTS${replacements.length}ZZ`;
    const standalone = new Set(["Pro", "MB", "GB", "HEIC", "JPEG", "JPG", "EXIF", "GPS", "Meta", "Unity", "EULA"]);
    const expression = standalone.has(term)
      ? new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
      : null;
    if (!(expression ? expression.test(result) : result.includes(term))) continue;
    replacements.push({ token, value: term });
    result = expression ? result.replace(expression, token) : result.replaceAll(term, token);
  }
  let placeholderIndex = 0;
  result = result.replace(/\{\{[^}]+\}\}/g, (placeholder) => {
    const token = `ZZPH${placeholderIndex++}ZZ`;
    replacements.push({ token, value: placeholder });
    return token;
  });
  return { protectedText: result, replacements };
}

function restore(value, replacements) {
  let result = value;
  for (const replacement of replacements) result = result.replaceAll(replacement.token, replacement.value);
  return result;
}

function samePlaceholders(source, translated) {
  const get = (value) => [...String(value).matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]).sort();
  return JSON.stringify(get(source)) === JSON.stringify(get(translated));
}

function preserveEdgeWhitespace(source, translated) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated.trim()}${trailing}`;
}

function makeBatches(entries) {
  const batches = [];
  let current = [];
  let currentLength = 0;
  for (const entry of entries) {
    const length = entry.protectedText.length + 22;
    if (current.length >= 18 || (current.length > 0 && currentLength + length > 2_600)) {
      batches.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(entry);
    currentLength += length;
  }
  if (current.length) batches.push(current);
  return batches;
}

async function fetchTranslation(text, target) {
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "en");
  endpoint.searchParams.set("tl", target);
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", text);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translated = (payload?.[0] ?? []).map((part) => part?.[0] ?? "").join("");
      if (translated) return translated;
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("Google Translate returned an empty response");
}

async function translateBatch(batch, target) {
  const request = batch.map((entry, index) => `[[[TSITEM${index.toString().padStart(3, "0")}]]] ${entry.protectedText}`).join("\n");
  const translated = await fetchTranslation(request, target);
  const values = new Map();
  const marker = /\[\[\[TSITEM(\d{3})\]\]\]\s*/g;
  const matches = [...translated.matchAll(marker)];
  if (matches.length !== batch.length) throw new Error(`Expected ${batch.length} markers but received ${matches.length}`);
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? translated.length;
    const raw = translated.slice(start, end).replace(/\n$/, "");
    const entry = batch[Number(matches[index][1])];
    if (!entry) throw new Error("Translation marker index was invalid");
    const restored = preserveEdgeWhitespace(entry.source, restore(raw, entry.replacements));
    if (!restored.trim() || !samePlaceholders(entry.source, restored) || /ZZ(?:TS|PH)\d+ZZ/.test(restored)) {
      throw new Error(`Invalid translation for ${entry.key}`);
    }
    values.set(entry.key, restored);
  }
  return values;
}

async function translateEntry(entry, target) {
  const raw = await fetchTranslation(entry.protectedText, target);
  const restored = preserveEdgeWhitespace(entry.source, restore(raw, entry.replacements));
  if (!restored.trim() || !samePlaceholders(entry.source, restored) || /ZZ(?:TS|PH)\d+ZZ/.test(restored)) {
    throw new Error(`Invalid translation for ${entry.key}`);
  }
  return restored;
}

async function translateBatchWithFallback(batch, target) {
  try {
    return await translateBatch(batch, target);
  } catch (error) {
    console.warn(`Batch fallback (${batch.length} entries): ${error instanceof Error ? error.message : String(error)}`);
    const recovered = new Map();
    for (const entry of batch) {
      try {
        recovered.set(entry.key, await translateEntry(entry, target));
      } catch (error) {
        console.warn(`Entry fallback failed for ${entry.key}: ${error instanceof Error ? error.message : String(error)}`);
        // The caller retains the existing catalog value for this one entry.
      }
    }
    return recovered;
  }
}

async function runPool(items, worker, concurrency = 5) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

const englishPath = path.join(localesDir, "en.json");
const english = JSON.parse(fs.readFileSync(englishPath, "utf8"));
for (const [key, value] of leafEntries(english)) setCatalogValue(english, key, repairSource(value));
if (!dryRun) fs.writeFileSync(englishPath, `${JSON.stringify(english, null, 2)}\n`, "utf8");
const reviewedOverrides = loadReviewedOverrides();

const files = fs.readdirSync(localesDir)
  .filter((file) => file.endsWith(".json") && file !== "en.json")
  .filter((file) => !localeArg || file === `${localeArg}.json`);

for (const file of files) {
  const fullPath = path.join(localesDir, file);
  const locale = file.slice(0, -".json".length);
  const current = repairEncoding(JSON.parse(fs.readFileSync(fullPath, "utf8")));
  const manualEdits = reviewedOverrides[locale] ?? {};
  const pending = leafEntries(english)
    .filter(([key, value]) => !isTechnicalEntry(key, value))
    .filter(([key]) => !selectedKeys.size || selectedKeys.has(key) || selectedKeys.has(key.replace(/^strings\./, "")))
    .filter(([key]) => !missingOnly || getCatalogValue(current, key) === undefined)
    .filter(([key, value]) => !unexpectedNewlinesOnly || (
      !/[\r\n]/.test(String(value)) && /[\r\n]/.test(String(getCatalogValue(current, key) ?? ""))
    ))
    .map(([key, value]) => {
      const source = String(value);
      const { protectedText, replacements } = protect(source);
      return { key, source, protectedText, replacements };
    });
  const batches = makeBatches(pending);
  const translatedBatches = await runPool(batches, (batch) => translateBatchWithFallback(batch, targetCodes[locale] ?? locale));
  const output = structuredClone(current);
  for (const [key, value] of leafEntries(english)) {
    if (isTechnicalEntry(key, value)) setCatalogValue(output, key, value);
  }
  for (const batch of translatedBatches) {
    for (const [key, value] of batch) setCatalogValue(output, key, value);
  }
  for (const [key, value] of Object.entries(manualEdits)) {
    // A historical bulk-import issue concatenated a neighbouring catalog value
    // with a newline. Do not restore one of those broken overrides over the
    // freshly translated single-line replacement.
    const source = getCatalogValue(english, key);
    if (unexpectedNewlinesOnly && !/[\r\n]/.test(String(source ?? "")) && /[\r\n]/.test(String(value))) continue;
    setCatalogValue(output, key, value);
  }
  if (!dryRun) fs.writeFileSync(fullPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`${file}: translated ${pending.length} values in ${batches.length} batches; restored ${Object.keys(manualEdits).length} reviewed edits.`);
}
