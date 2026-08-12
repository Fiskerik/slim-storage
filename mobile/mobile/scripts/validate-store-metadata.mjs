import fs from "node:fs";
import assert from "node:assert/strict";

const metadata = JSON.parse(fs.readFileSync(new URL("../app-store-metadata.json", import.meta.url), "utf8"));
assert.equal(metadata.locales.length, 29);
const { name, subtitle, promotionalText, description, keywords } = metadata.template;
assert.ok([...name].length <= 30);
assert.ok([...subtitle].length <= 30);
assert.ok([...promotionalText].length <= 170);
assert.ok([...description].length <= 4000);
assert.ok(Buffer.byteLength(keywords, "utf8") <= 100);
assert.equal(new Set(metadata.locales.map((locale) => locale.id)).size, 29);
console.log(`Validated ${metadata.locales.length} dry-run App Store listings.`);
