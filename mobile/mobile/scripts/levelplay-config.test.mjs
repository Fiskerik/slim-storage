import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import levelPlayPlugin from "../plugins/withLevelPlay.js";

const { addIosMediationPods } = levelPlayPlugin;

test("LevelPlay config adds the pinned Meta and Yandex adapters inside the iOS target", () => {
  const podfile = [
    "target 'TrimSwipe' do",
    "  use_expo_modules!",
    "end",
    "",
  ].join("\n");

  const configured = addIosMediationPods(podfile);

  assert.match(
    configured,
    /use_expo_modules!\n  pod 'IronSourceFacebookAdapter', '5\.4\.0\.0'\n  pod 'IronSourceYandexAdapter', '5\.12\.0\.0'/,
  );
  assert.equal(addIosMediationPods(configured), configured);
});

test("LevelPlay config adds Yandex when Meta is already configured", () => {
  const podfile = [
    "target 'TrimSwipe' do",
    "  use_expo_modules!",
    "  pod 'IronSourceFacebookAdapter', '5.4.0.0'",
    "end",
    "",
  ].join("\n");

  const configured = addIosMediationPods(podfile);

  assert.equal(configured.match(/IronSourceFacebookAdapter/g)?.length, 1);
  assert.match(configured, /pod 'IronSourceYandexAdapter', '5\.12\.0\.0'/);
});

test("LevelPlay config fails when Expo generates an unexpected Podfile", () => {
  assert.throws(
    () => addIosMediationPods("target 'TrimSwipe' do\nend\n"),
    /use_expo_modules! was not found/,
  );
});

test("swipe screen keeps a LevelPlay banner above every free-user photo", async () => {
  const app = await readFile(
    new URL("../components/NativeTrimSwipeApp.tsx", import.meta.url),
    "utf8",
  );
  const bannerIndex = app.indexOf(
    "<LevelPlayBanner isPro={isPro || !adEligibilityReady} />",
  );
  const deckIndex = app.indexOf(
    "<View style={[styles.deck, compactLayout && styles.deckCompact]}>",
  );

  assert.ok(bannerIndex >= 0, "the free-user banner must be eligibility gated");
  assert.ok(deckIndex > bannerIndex, "the banner must render above the photo deck");
  assert.doesNotMatch(app, /SwipeMidsetAdCard|showMidsetAd|midsetAdVisible/);
});

test("swipe actions stay above navigation and compact on short screens", async () => {
  const app = await readFile(
    new URL("../components/NativeTrimSwipeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(app, /const compactLayout = windowHeight <= 700 \|\| windowWidth <= 350;/);
  assert.match(app, /swipeContent: \{ flex: 1, paddingBottom: 142 \}/);
  assert.match(app, /deck: \{ flex: 1, minHeight: 0, maxHeight: 492, marginTop: 18 \}/);
  assert.match(app, /swipeActions: \{ position: "absolute", left: 20, right: 20, bottom: 76/);
  assert.match(app, /actionButtonSwipe: \{ height: 56, minHeight: 56/);
  assert.match(app, /actionButtonCompact: \{ height: 48, minHeight: 48/);
});

test("iOS config includes the Yandex SKAdNetwork identifier", async () => {
  const appConfig = await readFile(new URL("../app.config.ts", import.meta.url), "utf8");
  assert.match(appConfig, /zq492l623r\.skadnetwork/);
});

test("Codemagic verifies the pinned Yandex adapter and SDK", async () => {
  const pipeline = await readFile(
    new URL("../../../codemagic.yaml", import.meta.url),
    "utf8",
  );
  assert.match(pipeline, /IronSourceYandexAdapter \(5\.12\.0\.0\)/);
  assert.match(pipeline, /YandexMobileAds \(8\.3\.0\)/);
});
