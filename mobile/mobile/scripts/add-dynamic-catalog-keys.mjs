import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.resolve(fileURLToPath(new URL("../locales", import.meta.url)));
const additions = {
  "ui.continue-in-seconds": "Continue in {{seconds}} seconds",
  "ui.similar-photo-group-with-count": "Similar photo group with {{count}} photos",
  "ui.photos-to-compare": "{{count}} photos to compare",
  "ui.all-count": "All {{count}}",
  "ui.suggested-remove-count": "Suggested remove {{count}}",
  "ui.photos-processed": "{{count}} photo{{suffix}} processed.",
  "ui.tokens-added-to-balance": "+{{count}} tokens added to your balance.",
};
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
  const full = path.join(dir, file);
  const catalog = JSON.parse(fs.readFileSync(full, "utf8"));
  catalog.strings = { ...(catalog.strings ?? {}), ...additions };
  fs.writeFileSync(full, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}
console.log(`Added ${Object.keys(additions).length} interpolation keys.`);
