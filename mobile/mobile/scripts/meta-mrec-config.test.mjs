import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  normalizeMetaMrecPlacementId,
  resolveMetaMrecPlacementId,
} from "../lib/meta-mrec-config.ts";

test("Meta MREC config accepts only complete numeric placement IDs", () => {
  assert.equal(
    normalizeMetaMrecPlacementId(" 1040149312175162_1040151048841655 "),
    "1040149312175162_1040151048841655",
  );
  assert.equal(normalizeMetaMrecPlacementId(undefined), null);
  assert.equal(normalizeMetaMrecPlacementId("Native ad"), null);
  assert.equal(normalizeMetaMrecPlacementId("q8m51pm2jg2br5yf"), null);
  assert.equal(
    resolveMetaMrecPlacementId(undefined, " 1040149312175162_1040151048841655 "),
    "1040149312175162_1040151048841655",
  );
});

test("direct Meta MREC module pins the SDK and the 300x250 format", async () => {
  const podspec = await readFile(
    new URL("../modules/expo-meta-mrec/ExpoMetaMrec.podspec", import.meta.url),
    "utf8",
  );
  const swift = await readFile(
    new URL("../modules/expo-meta-mrec/ios/ExpoMetaMrecModule.swift", import.meta.url),
    "utf8",
  );

  assert.match(podspec, /s\.dependency 'FBAudienceNetwork', '6\.22\.0'/);
  assert.match(swift, /kFBAdSizeHeight250Rectangle/);
  assert.match(swift, /didFailWithError error: Error/);
});

test("Codemagic normalizes the Meta placement and accepts the Native-name alias", async () => {
  const pipeline = await readFile(
    new URL("../../../codemagic.yaml", import.meta.url),
    "utf8",
  );

  assert.match(
    pipeline,
    /META_IOS_MREC_PLACEMENT=\$\(printf '%s' "\$META_IOS_MREC_PLACEMENT" \| xargs\)/,
  );
  assert.match(pipeline, /EXPO_PUBLIC_META_IOS_NATIVE_PLACEMENT_ID/);
  assert.match(pipeline, /\^\[0-9\]\+_\[0-9\]\+\$/);
});
