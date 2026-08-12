import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = path.join(root, "locales");
const flatten = (value, prefix = "", result = {}) => { for (const [key, child] of Object.entries(value)) { const full = prefix ? `${prefix}.${key}` : key; if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, result); else result[full] = child; } return result; };
const files = fs.readdirSync(dir).filter((file) => file.endsWith(".json"));
const base = flatten(JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")));
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
  }
}
console.log(`Validated ${files.length} catalogs with ${Object.keys(base).length} keys each.`);
