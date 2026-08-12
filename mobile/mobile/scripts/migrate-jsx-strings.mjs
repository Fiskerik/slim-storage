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
}
const strings = Object.fromEntries([...values.entries()].sort(([a], [b]) => a.localeCompare(b)));
for (const file of componentFiles) {
  let source = fs.readFileSync(file, "utf8");
  for (const [key, value] of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    source = source.replace(new RegExp(`>${escaped}<`, "g"), `>{t("${key}")}<`);
  }
  if (source !== fs.readFileSync(file, "utf8")) {
    const relativeImport = file.includes(`${path.sep}components${path.sep}ui${path.sep}`) ? "../../lib/i18n" : "../lib/i18n";
    if (!source.includes("from \"" + relativeImport + "\"")) source = `import { t } from "${relativeImport}";\n` + source;
    fs.writeFileSync(file, source, "utf8");
  }
}
const localesDir = path.join(root, "locales");
for (const file of fs.readdirSync(localesDir).filter((name) => name.endsWith(".json"))) {
  const full = path.join(localesDir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  catalog.strings = { ...(catalog.strings ?? {}), ...strings };
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}
console.log(`Migrated ${values.size} JSX strings across ${componentFiles.length} component files and ${fs.readdirSync(localesDir).length} catalogs.`);
