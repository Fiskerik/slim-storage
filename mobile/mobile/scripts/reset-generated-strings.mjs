import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.resolve(fileURLToPath(new URL("../locales", import.meta.url)));
const english = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json") && name !== "en.json")) {
  const full = path.join(dir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  catalog.strings = { ...english.strings };
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}
console.log("Reset generated UI strings to the English source catalog.");
