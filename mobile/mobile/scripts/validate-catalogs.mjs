import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = path.join(root, "locales");
const flatten = (value, prefix = "", result = {}) => { for (const [key, child] of Object.entries(value)) { const full = prefix ? `${prefix}.${key}` : key; if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, result); else result[full] = child; } return result; };
const sourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(directory, entry.name);
  if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "assets" ? [] : sourceFiles(full);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [full] : [];
});
const navKeys = ["strings.ui.home", "strings.ui.games", "strings.ui.auto", "strings.ui.shop", "strings.ui.stats", "strings.ui.settings"];
const mojibakePattern = /Ã.|Â(?:·|…|©|®|™|[0-9])|â[\u0080-\u00BF]|�/u;
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
const base = flatten(JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")));
const runtimeKeys = new Set(Object.keys(base).flatMap((key) => key.startsWith("strings.") ? [key, key.slice("strings.".length)] : [key]));
const usedKeys = new Set();
for (const file of sourceFiles(root)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\s*\(\s*"([^"]+)"/g)) usedKeys.add(match[1]);
  for (const match of source.matchAll(/\bt\s*\(\s*'([^']+)'/g)) usedKeys.add(match[1]);
}
const missingSourceKeys = [...usedKeys].filter((key) => /^(?:ui|settings|nav|app)\./.test(key) && !runtimeKeys.has(key));
if (missingSourceKeys.length) throw new Error(`Missing English catalog keys used by source: ${missingSourceKeys.join(", ")}`);
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  if (/ZXQ|ZXTERM|ZXPLACE|TRIMITEM|⟦|�/.test(raw)) throw new Error(`${file}: translation marker or replacement character found`);
  const catalog = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
  const missing = Object.keys(base).filter((key) => !(key in catalog));
  if (missing.length) throw new Error(`${file}: missing ${missing.join(", ")}`);
  for (const key of Object.keys(base)) {
    const placeholders = (String(base[key]).match(/\{\{[^}]+\}\}/g) ?? []).sort().join("|");
    const translatedPlaceholders = (String(catalog[key]).match(/\{\{[^}]+\}\}/g) ?? []).sort().join("|");
    if (placeholders !== translatedPlaceholders) throw new Error(`${file}: placeholder mismatch in ${key}`);
    if (mojibakePattern.test(String(catalog[key]))) throw new Error(`${file}: encoding corruption in ${key}`);
    // A previous bulk-import tool occasionally joined the next catalog value
    // onto the current translation. The source catalog does not use embedded
    // newlines, so one here is always an invalid, user-visible artifact.
    if (!/[\r\n]/.test(String(base[key])) && /[\r\n]/.test(String(catalog[key]))) {
      throw new Error(`${file}: unexpected newline in ${key}`);
    }
  }
  for (const key of navKeys) {
    const label = String(catalog[key] ?? "").trim();
    if (!label || label.startsWith("ui.") || /[\r\n]/.test(label)) throw new Error(`${file}: invalid navigation label in ${key}`);
  }
}
console.log(`Validated ${files.length} catalogs with ${Object.keys(base).length} keys each.`);
