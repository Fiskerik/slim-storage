import fs from "node:fs";
import assert from "node:assert/strict";

const metadata = JSON.parse(fs.readFileSync(new URL("../app-store-metadata.json", import.meta.url), "utf8"));
assert.equal(metadata.locales.length, 30);
const validateListing = ({ locale, name, subtitle, promotionalText, description, keywords, releaseNotes }) => {
  assert.ok([...name].length <= 30, `${name} exceeds name limit`);
  assert.ok([...subtitle].length <= 30, `${subtitle} exceeds subtitle limit`);
  assert.ok([...promotionalText].length <= 170, "promotional text exceeds limit");
  assert.ok([...description].length <= 4000, "description exceeds limit");
  assert.ok(releaseNotes && [...releaseNotes].length <= 4000, "release notes are empty or exceed the limit");
  assert.ok(description.includes("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"), `${locale ?? "template"} is missing the EULA URL`);
  assert.ok(Buffer.byteLength(keywords, "utf8") <= 100, `keywords exceed 100 bytes: ${keywords}`);
  assert.ok(Buffer.byteLength(keywords, "utf8") >= 80, `keywords use fewer than 80 bytes: ${keywords}`);
  if (locale?.startsWith("en-")) {
    assert.ok([...promotionalText].length >= 160, `${locale} promotional text uses fewer than 160 characters`);
    const indexedWords = new Set(`${name} ${subtitle} ${keywords}`.toLowerCase().match(/[a-z]+/g) ?? []);
    const promoWords = new Set(promotionalText.toLowerCase().match(/[a-z]+/g) ?? []);
    const allowedGrammarWords = new Set(["a", "an", "and", "for", "of", "the", "to", "with", "your"]);
    const duplicated = [...promoWords].filter((word) => indexedWords.has(word) && !allowedGrammarWords.has(word));
    assert.deepEqual(duplicated, [], `${locale} promotional text repeats indexed terms: ${duplicated.join(", ")}`);
  }
};
validateListing(metadata.template);
assert.equal(metadata.localizedListings.length, 30);
metadata.localizedListings.forEach(validateListing);
assert.equal(new Set(metadata.locales.map((locale) => locale.id)).size, 30);
console.log(`Validated ${metadata.locales.length} dry-run App Store listings.`);
