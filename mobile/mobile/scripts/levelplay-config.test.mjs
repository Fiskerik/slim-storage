import assert from "node:assert/strict";
import test from "node:test";
import levelPlayPlugin from "../plugins/withLevelPlay.js";

const { addIosMediationPods } = levelPlayPlugin;

test("LevelPlay config adds the pinned Meta adapter inside the iOS target", () => {
  const podfile = [
    "target 'TrimSwipe' do",
    "  use_expo_modules!",
    "end",
    "",
  ].join("\n");

  const configured = addIosMediationPods(podfile);

  assert.match(
    configured,
    /use_expo_modules!\n  pod 'IronSourceFacebookAdapter', '5\.4\.0\.0'/,
  );
  assert.equal(addIosMediationPods(configured), configured);
});

test("LevelPlay config fails when Expo generates an unexpected Podfile", () => {
  assert.throws(
    () => addIosMediationPods("target 'TrimSwipe' do\nend\n"),
    /use_expo_modules! was not found/,
  );
});
