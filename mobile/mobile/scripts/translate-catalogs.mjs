import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = path.join(root, "locales");
const targetCodes = { "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", "pt-BR": "pt", no: "no" };
const locales = fs.readdirSync(dir).filter((file) => file.endsWith(".json") && file !== "en.json");
const terms = ["TrimSwipe", "Pro", "iCloud", "Live Photos", "App Store", "MB", "GB"];

function protect(value) {
  let result = value;
  terms.forEach((term, index) => { result = result.replaceAll(term, `ZXTERM${index}ZX`); });
  let placeholderIndex = 0;
  result = result.replace(/\{\{[^}]+\}\}/g, () => `ZXPLACE${placeholderIndex++}ZX`);
  return result;
}
function restore(value, source) {
  const placeholders = [...String(source).matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
  return value.replace(/ZXTERM(\d+)ZX/g, (_, index) => terms[Number(index)] ?? "").replace(/ZXPLACE\s*(\d+)\s*ZX/g, (_, index) => placeholders[Number(index)] ? `{{${placeholders[Number(index)]}}}` : "");
}
async function translate(text, target) {
  const query = encodeURIComponent(protect(text));
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${query}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation failed (${response.status})`);
  const payload = await response.json();
  return restore((payload?.[0] ?? []).map((part) => part?.[0] ?? "").join(""), text);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const file of locales) {
  const full = path.join(dir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  const target = targetCodes[file.slice(0, -5)] ?? file.slice(0, -5);
  const entries = Object.entries(catalog.strings ?? {});
  const starts = Array.from({ length: Math.ceil(entries.length / 12) }, (_, index) => index * 12);
  const translatedChunks = await Promise.all(starts.map(async (start) => {
    const chunk = entries.slice(start, start + 12);
    const markers = chunk.map(([, value], index) => `ZXQ${index}ZX ${protect(String(value))}`).join("\n");
    let translated;
    try {
      translated = await translate(markers, target);
    } catch {
      translated = markers;
      for (let index = 0; index < chunk.length; index += 1) {
        try {
          const value = await translate(String(chunk[index][1]), target);
          translated = translated.replace(`ZXQ${index}ZX ${protect(String(chunk[index][1]))}`, `ZXQ${index}ZX ${value}`);
        } catch {
          // Keep the English source for a single rejected phrase and continue the catalog.
        }
      }
    }
    const result = {};
    for (let index = 0; index < chunk.length; index += 1) {
      const marker = `ZXQ${index}ZX`;
      const line = translated.split(/\r?\n/).find((candidate) => candidate.includes(marker));
      if (!line) result[chunk[index][0]] = chunk[index][1];
      else {
        const candidate = line.replace(marker, "").trim();
        const required = [...String(chunk[index][1]).matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
        const valid = required.every((name) => candidate.includes(`{{${name}}}`));
        result[chunk[index][0]] = valid ? candidate : chunk[index][1];
      }
    }
    return result;
  }));
  for (const result of translatedChunks) catalog.strings = { ...catalog.strings, ...result };
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Translated ${file}`);
}
