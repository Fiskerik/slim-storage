import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const componentFiles = fs.readdirSync(path.join(root, "components"), { recursive: true })
  .filter((file) => typeof file === "string" && /\.(tsx|ts)$/.test(file))
  .map((file) => path.join(root, "components", file));
const values = new Map();
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "text";
for (const file of componentFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/>([A-Za-z][^<>{}\n]{1,100})</g)) {
    const value = match[1].trim();
    if (value && !value.includes("=>") && !value.includes("{")) values.set(`ui.${slug(value)}`, value);
  }
  for (const match of source.matchAll(/\b(label|title|subtitle|placeholder|accessibilityLabel|message|description|hint|emptyText|buttonLabel|header|body|caption|eyebrow|helperText|errorText|successText)=(?:"([^"]+)"|'([^']+)')/g)) {
    const value = (match[2] ?? match[3] ?? "").trim();
    if (value && /[A-Za-z]/.test(value)) values.set(`ui.${slug(value)}`, value);
  }
  for (const match of source.matchAll(/\b(Alert\.alert|showToast|notifyCleanupProgress)\(\s*["']([^"']+)["']/g)) {
    const value = match[2].trim();
    if (value && /[A-Za-z]/.test(value)) values.set(`ui.${slug(value)}`, value);
  }
  for (const match of source.matchAll(/(["'])([^"'\n]{4,180})\1/g)) {
    const value = match[2].trim();
    if (value && /[A-Z]/.test(value) && /\s/.test(value) && !/[\\/@#={}<>]/.test(value)) values.set(`ui.${slug(value)}`, value);
  }
}
const strings = Object.fromEntries([...values.entries()].sort(([a], [b]) => a.localeCompare(b)));
Object.assign(strings, {
  "ui.delete-prefix": "Delete: ",
  "ui.trim-prefix": "Trim: ",
  "ui.start-with-a-scan": "Start with a scan. TrimSwipe estimates photo storage, trim potential, uncategorized groups, and bad shots worth reviewing.",
});
for (const file of componentFiles) {
  let source = fs.readFileSync(file, "utf8");
  for (const [key, value] of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    source = source.replace(new RegExp(`>${escaped}<`, "g"), `>{t("${key}")}<`);
    source = source.replace(new RegExp(`(\\b(?:label|title|subtitle|placeholder|accessibilityLabel|message|description|hint|emptyText|buttonLabel|header|body|caption|eyebrow|helperText|errorText|successText)=)["']${escaped}["']`, "g"), `$1{t("${key}")}`);
    source = source.replace(new RegExp(`(\\b(?:Alert\\.alert|showToast|notifyCleanupProgress)\\(\\s*)["']${escaped}["']`, "g"), `$1t("${key}")`);
    source = source.replace(new RegExp(`(["'])${escaped}\\1`, "g"), `t("${key}")`);
  }
  source = source.replace(/>Delete: </g, '>{t("ui.delete-prefix")}<').replace(/>Trim: </g, '>{t("ui.trim-prefix")}<');
  source = source.replace(/>Start with a scan\. TrimSwipe estimates photo storage, trim potential, uncategorized groups, and bad shots worth reviewing\.<\/Text>/g, '>{t("ui.start-with-a-scan")}</Text>');
  if (source !== fs.readFileSync(file, "utf8")) {
    const relativeImport = file.includes(`${path.sep}components${path.sep}ui${path.sep}`) ? "../../lib/i18n" : "../lib/i18n";
    if (!source.includes("from \"" + relativeImport + "\"")) source = `import { t } from "${relativeImport}";\n` + source;
    fs.writeFileSync(file, source, "utf8");
  }
}
const localesDir = path.join(root, "locales");
const englishCatalog = JSON.parse(fs.readFileSync(path.join(localesDir, "en.json"), "utf8"));
const mergeMissing = (target, fallback) => { for (const [key, value] of Object.entries(fallback)) { if (target[key] === undefined) target[key] = value; else if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object") mergeMissing(target[key], value); } return target; };
for (const file of fs.readdirSync(localesDir).filter((name) => name.endsWith(".json"))) {
  const full = path.join(localesDir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  mergeMissing(catalog, englishCatalog);
  catalog.strings = { ...(catalog.strings ?? {}), ...strings };
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}
console.log(`Migrated ${values.size} JSX strings across ${componentFiles.length} component files and ${fs.readdirSync(localesDir).length} catalogs.`);
