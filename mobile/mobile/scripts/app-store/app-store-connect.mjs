import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const API_ROOT = "https://api.appstoreconnect.apple.com/v1";
const config = JSON.parse(readFileSync(path.join(SCRIPT_DIR, "appstore.config.json"), "utf8"));

const args = process.argv.slice(2);
const command = args[0] ?? "preview";
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const version = option("--version");
const metadataPath = path.resolve(
  process.cwd(),
  option("--metadata") ?? path.join(PROJECT_ROOT, config.metadataPath),
);

if (!version) fail("Pass the App Store version with --version, for example --version 1.1.3.");
if (!new Set(["preview", "upload"]).has(command)) fail(`Unknown command: ${command}`);

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const listings = normalizeAndValidate(metadata);
printPreview(listings, metadata);

if (command === "preview") {
  console.log("\nPreview only. No App Store Connect requests were made.");
} else {
  await uploadListings(listings, metadata);
}

function normalizeAndValidate(source) {
  const errors = [];
  const seen = new Set();
  const rows = (source.localizedListings ?? []).map((listing) => {
    const locale = config.localeMap[listing.locale] ?? listing.locale;
    if (seen.has(locale)) errors.push(`Duplicate App Store locale after mapping: ${locale}`);
    seen.add(locale);

    const row = {
      ...listing,
      locale,
      name: clean(listing.name),
      subtitle: clean(listing.subtitle),
      promotionalText: clean(listing.promotionalText),
      description: clean(listing.description),
      keywords: clean(listing.keywords),
      releaseNotes: clean(listing.releaseNotes),
    };
    requireField(errors, row, "name");
    requireField(errors, row, "subtitle");
    requireField(errors, row, "promotionalText");
    requireField(errors, row, "description");
    requireField(errors, row, "keywords");
    requireField(errors, row, "releaseNotes");
    limit(errors, row, "name", 30);
    limit(errors, row, "subtitle", 30);
    limit(errors, row, "promotionalText", 170);
    limit(errors, row, "description", 4000);
    limit(errors, row, "releaseNotes", 4000);
    if (Buffer.byteLength(row.keywords, "utf8") > 100) {
      errors.push(`${locale}: keywords exceed 100 UTF-8 bytes.`);
    }
    return row;
  });

  if (!rows.length) errors.push("localizedListings is empty.");
  if (source.locales?.length !== rows.length) {
    errors.push(`Locale/listing count mismatch: ${source.locales?.length ?? 0}/${rows.length}.`);
  }
  if (errors.length) fail(`Metadata validation failed:\n- ${errors.join("\n- ")}`);
  return rows;
}

function printPreview(rows, source) {
  console.log(`App Store localization preview for iOS ${version}`);
  console.log(`Bundle ID: ${process.env.ASC_BUNDLE_ID ?? config.bundleId}`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Locales: ${rows.length}`);
  console.log(`Source dryRun flag: ${Boolean(source.dryRun)}`);
  for (const row of rows) {
    console.log(
      `  ${row.locale}: name ${chars(row.name)}/30, subtitle ${chars(row.subtitle)}/30, ` +
        `promo ${chars(row.promotionalText)}/170, description ${chars(row.description)}/4000, ` +
        `keywords ${Buffer.byteLength(row.keywords, "utf8")}/100 bytes, what's new ${chars(row.releaseNotes)}/4000`,
    );
  }

  const unresolvedProducts = (source.productLocalizations ?? [])
    .map((item) => item.productId)
    .filter((id) => !config.productIdMap[id]);
  console.log("\nThis command uploads app listing localizations only.");
  console.log("Product localizations and screenshots are not modified.");
  if (unresolvedProducts.length) {
    console.warn(`Unmapped product aliases in metadata: ${unresolvedProducts.join(", ")}`);
  }
}

async function uploadListings(rows, source) {
  const token = createToken();
  const appId = await resolveAppId(token);
  const appVersion = await resolveVersion(token, appId);
  const appInfo = await resolveAppInfo(token, appId, appVersion);

  const versionResponse = await api(token, `/appStoreVersions/${appVersion.id}/appStoreVersionLocalizations?limit=200`);
  const versionLocales = new Map(versionResponse.data.map((item) => [item.attributes.locale, item]));
  const infoResponse = await api(token, `/appInfos/${appInfo.id}/appInfoLocalizations?limit=200`);
  const infoLocales = new Map(infoResponse.data.map((item) => [item.attributes.locale, item]));

  const totals = { infoCreated: 0, infoUpdated: 0, infoUnchanged: 0, versionCreated: 0, versionUpdated: 0, versionUnchanged: 0 };
  for (const row of rows) {
    await upsertAppInfo(token, appInfo.id, row, infoLocales, totals, source);
    await upsertVersion(token, appVersion.id, row, versionLocales, totals, source);
  }

  console.log(`\nUploaded app listing metadata for iOS ${version}.`);
  console.log(`App Info: ${totals.infoCreated} created, ${totals.infoUpdated} updated, ${totals.infoUnchanged} unchanged.`);
  console.log(`Version: ${totals.versionCreated} created, ${totals.versionUpdated} updated, ${totals.versionUnchanged} unchanged.`);
}

async function upsertAppInfo(token, appInfoId, row, existingMap, totals, source) {
  const existing = existingMap.get(row.locale);
  const desired = {
    name: row.name,
    subtitle: row.subtitle,
    privacyPolicyUrl: clean(source.urls?.privacy),
  };
  if (!desired.privacyPolicyUrl) delete desired.privacyPolicyUrl;

  if (!existing) {
    const result = await api(token, "/appInfoLocalizations", {
      method: "POST",
      allowConflict: true,
      body: {
        data: {
          type: "appInfoLocalizations",
          attributes: { locale: row.locale, ...desired },
          relationships: { appInfo: { data: { type: "appInfos", id: appInfoId } } },
        },
      },
    });
    if (result.conflict) {
      console.warn(`App Info ${row.locale} exists on another App Info record; skipped.`);
      totals.infoUnchanged += 1;
    } else {
      totals.infoCreated += 1;
    }
    return;
  }

  const attributes = changedAttributes(existing.attributes, desired);
  if (!Object.keys(attributes).length) {
    totals.infoUnchanged += 1;
    return;
  }
  await api(token, `/appInfoLocalizations/${existing.id}`, {
    method: "PATCH",
    body: { data: { type: "appInfoLocalizations", id: existing.id, attributes } },
  });
  totals.infoUpdated += 1;
}

async function upsertVersion(token, versionId, row, existingMap, totals, source) {
  const desired = {
    description: row.description,
    keywords: row.keywords,
    promotionalText: row.promotionalText,
    whatsNew: row.releaseNotes,
    supportUrl: clean(source.urls?.support),
    marketingUrl: clean(source.urls?.marketing),
  };
  if (!desired.supportUrl) delete desired.supportUrl;
  if (!desired.marketingUrl) delete desired.marketingUrl;
  let existing = existingMap.get(row.locale);

  if (!existing) {
    const result = await api(token, "/appStoreVersionLocalizations", {
      method: "POST",
      allowConflict: true,
      body: {
        data: {
          type: "appStoreVersionLocalizations",
          attributes: { locale: row.locale, ...desired },
          relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } },
        },
      },
    });
    if (!result.conflict) {
      totals.versionCreated += 1;
      return;
    }
    const refreshed = await api(token, `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=200`);
    existing = refreshed.data.find((item) => item.attributes.locale === row.locale);
    if (!existing) fail(`Apple reports version locale ${row.locale} exists, but it could not be retrieved.`);
  }

  const attributes = changedAttributes(existing.attributes, desired);
  if (!Object.keys(attributes).length) {
    totals.versionUnchanged += 1;
    return;
  }
  await api(token, `/appStoreVersionLocalizations/${existing.id}`, {
    method: "PATCH",
    body: { data: { type: "appStoreVersionLocalizations", id: existing.id, attributes } },
  });
  totals.versionUpdated += 1;
}

function createToken() {
  const issuerId = process.env.ASC_ISSUER_ID;
  const keyId = process.env.ASC_KEY_ID;
  const keyPath = process.env.ASC_PRIVATE_KEY_PATH;
  const inlineKey = process.env.ASC_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!issuerId || !keyId || (!inlineKey && !keyPath)) {
    fail("Upload requires ASC_ISSUER_ID, ASC_KEY_ID, and ASC_PRIVATE_KEY_PATH or ASC_PRIVATE_KEY.");
  }
  const key = inlineKey ?? readFileSync(path.resolve(keyPath), "utf8");
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = encode({ iss: issuerId, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function resolveAppId(token) {
  if (process.env.ASC_APP_ID) return process.env.ASC_APP_ID;
  const bundleId = process.env.ASC_BUNDLE_ID ?? config.bundleId;
  const response = await api(token, `/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=10`);
  if (response.data.length !== 1) fail(`Expected one app for bundle ID ${bundleId}; found ${response.data.length}.`);
  return response.data[0].id;
}

async function resolveVersion(token, appId) {
  const response = await api(token, `/apps/${appId}/appStoreVersions?limit=200`);
  const matches = response.data.filter(
    (item) => item.attributes.versionString === version && item.attributes.platform === config.platform,
  );
  if (matches.length !== 1) {
    fail(`Expected one ${config.platform} App Store version ${version}; found ${matches.length}. Create the version first.`);
  }
  return matches[0];
}

async function resolveAppInfo(token, appId, appVersion) {
  if (process.env.ASC_APP_INFO_ID) return { id: process.env.ASC_APP_INFO_ID };
  const response = await api(token, `/apps/${appId}/appInfos?limit=200`);
  const records = response.data.filter((item) => item.attributes?.appStoreState);
  if (records.length === 1) return records[0];
  const versionState = appVersion.attributes.appStoreState;
  const preferred = versionState === "READY_FOR_SALE"
    ? records.filter((item) => item.attributes.appStoreState === "READY_FOR_SALE")
    : records.filter((item) => item.attributes.appStoreState !== "READY_FOR_SALE");
  if (preferred.length === 1) return preferred[0];
  const states = records.map((item) => `${item.id}:${item.attributes.appStoreState}`).join(", ");
  fail(`Could not choose the App Info record (${states}). Set ASC_APP_INFO_ID explicitly.`);
}

async function api(token, endpoint, { method = "GET", body, allowConflict = false } = {}) {
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (response.status === 409 && allowConflict) return { conflict: true, payload };
  if (!response.ok) {
    const detail = payload.errors?.map((item) => item.detail).filter(Boolean).join("; ");
    fail(`App Store Connect API ${response.status}: ${detail || text || response.statusText}`);
  }
  return { conflict: false, ...payload };
}

function changedAttributes(existing, desired) {
  return Object.fromEntries(Object.entries(desired).filter(([key, value]) => clean(existing[key]) !== clean(value)));
}
function clean(value) { return String(value ?? "").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n").trim(); }
function chars(value) { return Array.from(value).length; }
function requireField(errors, row, key) { if (!row[key]) errors.push(`${row.locale}: ${key} is empty.`); }
function limit(errors, row, key, maximum) { if (chars(row[key]) > maximum) errors.push(`${row.locale}: ${key} exceeds ${maximum} characters.`); }
function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function fail(message) { console.error(`ERROR: ${message}`); process.exit(1); }
