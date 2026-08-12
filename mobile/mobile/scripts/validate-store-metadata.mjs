import fs from "node:fs";
import assert from "node:assert/strict";

const metadata = JSON.parse(fs.readFileSync(new URL("../app-store-metadata.json", import.meta.url), "utf8"));
assert.equal(metadata.locales.length, 29);
const validateListing = ({ name, subtitle, promotionalText, description, keywords }) => {
  assert.ok([...name].length <= 30, `${name} exceeds name limit`);
  assert.ok([...subtitle].length <= 30, `${subtitle} exceeds subtitle limit`);
  assert.ok([...promotionalText].length <= 170, "promotional text exceeds limit");
  assert.ok([...description].length <= 4000, "description exceeds limit");
  assert.ok(Buffer.byteLength(keywords, "utf8") <= 100, `keywords exceed 100 bytes: ${keywords}`);
};
validateListing(metadata.template);
assert.equal(metadata.localizedListings.length, 29);
metadata.localizedListings.forEach(validateListing);
assert.equal(new Set(metadata.locales.map((locale) => locale.id)).size, 29);
console.log(`Validated ${metadata.locales.length} dry-run App Store listings.`);
