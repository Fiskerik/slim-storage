import assert from "node:assert/strict";
import test from "node:test";

const { buildDailyCleanupPlan, selectSuggestedTrimIds } = await import("../lib/daily-cleanup-policy.ts");

const settings = {
  trimKinds: ["metadata", "location", "compression"],
  trimQuality: 0.9,
  trimReviewMode: "normal",
};

function photo(id, overrides = {}) {
  return {
    id,
    uri: `ph://${id}`,
    localUri: `file://${id}.jpg`,
    title: id,
    year: 2026,
    month: "Aug",
    device: "iPhone",
    sizeMB: 10,
    width: 1000,
    height: 1000,
    hasGPS: false,
    isCloudAsset: false,
    creationTime: Date.now(),
    cleanupReasons: [],
    ...overrides,
  };
}

test("daily policy prefers verified duplicate deletion, then safe trimming", () => {
  const source = {
    photos: [photo("keeper"), photo("duplicate"), photo("screenshot")],
    duplicateGroups: [{ id: "g1", photos: [photo("keeper"), photo("duplicate")], suggestedKeeperId: "keeper" }],
    similarityAnalysis: "vision",
  };
  const plan = buildDailyCleanupPlan(source, settings, (item) => ({
    canTrim: item.id !== "duplicate",
    trimSavingsMB: item.id === "screenshot" ? 3 : 2,
  }), new Date("2026-08-16T20:30:00"));

  assert.equal(plan.dayKey, "2026-08-16");
  assert.equal(plan.items.find((item) => item.photo.id === "duplicate")?.suggestedAction, "delete");
  assert.equal(plan.items.find((item) => item.photo.id === "keeper")?.suggestedAction, "trim");
  assert.equal(plan.items.find((item) => item.photo.id === "screenshot")?.suggestedAction, "trim");
  assert.equal(plan.estimatedDeleteSavingsMB, 10);
  assert.equal(plan.estimatedTrimSavingsMB, 5);
});

test("unverified similarity never creates an automatic deletion", () => {
  const source = { photos: [photo("a"), photo("b")], duplicateGroups: [], similarityAnalysis: "unavailable" };
  const plan = buildDailyCleanupPlan(source, settings, () => ({ canTrim: false, trimSavingsMB: 0 }));
  assert.deepEqual(plan.deleteSuggestions, []);
  assert.ok(plan.items.every((item) => item.suggestedAction === "keep"));
});

test("trim token selection keeps the highest-saving suggestions", () => {
  const source = { photos: [photo("small"), photo("large"), photo("middle")], duplicateGroups: [], similarityAnalysis: "vision" };
  const plan = buildDailyCleanupPlan(source, settings, (item) => ({
    canTrim: true,
    trimSavingsMB: item.id === "large" ? 12 : item.id === "middle" ? 7 : 2,
  }));
  assert.deepEqual([...selectSuggestedTrimIds(plan, 2)], ["large", "middle"]);
});

test("already optimized photos stay visible but are not suggested", () => {
  const source = { photos: [photo("optimized", { trimState: { applied: ["compression"], updatedAt: "2026-08-16T10:00:00Z", blockedReason: "already-optimized" } })], duplicateGroups: [], similarityAnalysis: "vision" };
  const plan = buildDailyCleanupPlan(source, settings, () => ({ canTrim: false, trimSavingsMB: 0 }));
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].suggestedAction, "keep");
  assert.match(plan.items[0].reason, /Already optimized/);
});

test("cloud-only duplicate copies are never preselected for deletion", () => {
  const source = {
    photos: [photo("keeper"), photo("cloud-copy", { isCloudAsset: true })],
    duplicateGroups: [{ id: "g-cloud", photos: [photo("keeper"), photo("cloud-copy", { isCloudAsset: true })], suggestedKeeperId: "keeper" }],
    similarityAnalysis: "vision",
  };
  const plan = buildDailyCleanupPlan(source, settings, () => ({ canTrim: true, trimSavingsMB: 4 }));
  const cloudCopy = plan.items.find((item) => item.photo.id === "cloud-copy");
  assert.equal(cloudCopy?.suggestedAction, "keep");
  assert.deepEqual(plan.deleteSuggestions, []);
});
