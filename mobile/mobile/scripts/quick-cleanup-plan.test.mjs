import test from "node:test";
import assert from "node:assert/strict";
import { buildMonthCleanupProgress, buildQuickCleanupPlan, rebuildQuickCleanupPlan } from "../lib/quick-cleanup-plan.ts";
import { defaultQuickCleanupGroupChoice, resolveQuickCleanupGroupActions } from "../lib/quick-cleanup-group-policy.ts";

const photo = (id, sizeMB = 10, creationTime = Date.parse("2026-01-15T12:00:00Z")) => ({
  id,
  uri: `file://${id}.jpg`,
  localUri: `file://${id}.jpg`,
  title: `${id}.jpg`,
  year: 2026,
  month: "Jan",
  device: "Test",
  sizeMB,
  width: 1000,
  height: 1000,
  hasGPS: false,
  isCloudAsset: false,
  creationTime,
  cleanupReasons: [],
});

test("quick plan prefers verified deletion review before lower-confidence trims", () => {
  const exact = { photo: photo("exact", 40), action: "delete", confidence: "verified", estimatedSavingsMB: 40, reviewSeconds: 3, reason: "exact", preselect: false };
  const trim = { photo: photo("trim", 20), action: "trim", confidence: "high", estimatedSavingsMB: 8, reviewSeconds: 5, reason: "compress", preselect: true };
  const plan = buildQuickCleanupPlan([trim, exact], { budgetSeconds: 30, trimBalance: 1 });
  assert.equal(plan.items[0].photo.id, "exact");
  assert.equal(plan.items[0].selected, false);
  assert.equal(plan.items[1].selected, true);
  assert.equal(plan.estimatedSavingsMB, 8);
});

test("quick plan never exceeds free trim balance and excludes protected photos", () => {
  const candidates = [1, 2, 3].map((index) => ({ photo: photo(`p${index}`, 10), action: "trim", confidence: "high", estimatedSavingsMB: index * 2, reviewSeconds: 5, reason: "compress", preselect: true }));
  const plan = buildQuickCleanupPlan(candidates, { budgetSeconds: 30, trimBalance: 1, protectedIds: ["p3"] });
  assert.deepEqual(plan.selectedItems.map((item) => item.photo.id), ["p2"]);
  assert.equal(plan.items.some((item) => item.photo.id === "p3"), false);
});

test("quick plan ignores malformed native candidates instead of crashing preview", () => {
  const malformed = { photo: null, action: "trim", confidence: "high", estimatedSavingsMB: 10, reviewSeconds: 5, reason: "bad metadata", preselect: true };
  const valid = { photo: photo("valid", 10), action: "trim", confidence: "high", estimatedSavingsMB: 4, reviewSeconds: 5, reason: "compress", preselect: true };
  const plan = buildQuickCleanupPlan([malformed, valid], { budgetSeconds: 30, trimBalance: 1 });
  assert.deepEqual(plan.items.map((item) => item.photo.id), ["valid"]);
});

test("changing the session budget rebuilds the cached plan without replacing its photos", () => {
  const candidates = [1, 2, 3].map((index) => ({
    photo: photo(`cached-${index}`, 10),
    action: "trim",
    confidence: "high",
    estimatedSavingsMB: 6 - index,
    reviewSeconds: 20,
    reason: "compress",
    preselect: true,
  }));
  const original = buildQuickCleanupPlan(candidates, { budgetSeconds: 120, trimBalance: 3 });
  const rebuilt = rebuildQuickCleanupPlan(original, { budgetSeconds: 30, trimBalance: 3 });

  assert.deepEqual(rebuilt.items.map((item) => item.photo), original.items.map((item) => item.photo));
  assert.equal(rebuilt.budgetSeconds, 30);
  assert.equal(rebuilt.selectedItems.length, 1);
});

test("group review suggests one keeper without preselecting any deletion", () => {
  const group = {
    id: "similar-1",
    kind: "similar",
    photos: [photo("keeper"), photo("other-1"), photo("other-2")],
    suggestedKeeperId: "keeper",
  };
  const choice = defaultQuickCleanupGroupChoice(group);
  const actions = resolveQuickCleanupGroupActions({
    photos: group.photos,
    choice,
    trimOptions: [],
    trimLimit: 0,
  });

  assert.deepEqual(choice.keptIds, ["keeper"]);
  assert.deepEqual(actions, { keeper: "keep", "other-1": "keep", "other-2": "keep" });
});

test("group review applies explicit delete choices but always keeps protected photos", () => {
  const photos = [photo("keeper"), photo("delete-me"), photo("protected")];
  const actions = resolveQuickCleanupGroupActions({
    photos,
    choice: { keptIds: ["keeper"], keptAction: "keep", unkeptAction: "delete" },
    trimOptions: [],
    protectedIds: ["protected"],
    trimLimit: 0,
  });

  assert.deepEqual(actions, { keeper: "keep", "delete-me": "delete", protected: "keep" });
});

test("group review spends trim capacity on the highest-saving safe photos", () => {
  const photos = [photo("low"), photo("high"), photo("unsupported")];
  const actions = resolveQuickCleanupGroupActions({
    photos,
    choice: { keptIds: [], keptAction: "keep", unkeptAction: "trim" },
    trimOptions: [
      { photoId: "low", estimatedSavingsMB: 2, reason: "trim" },
      { photoId: "high", estimatedSavingsMB: 8, reason: "trim" },
    ],
    trimLimit: 1,
  });

  assert.deepEqual(actions, { low: "keep", high: "trim", unsupported: "keep" });
});

test("month progress is resumable and uses local calendar months", () => {
  const photos = [photo("jan-1", 10, Date.parse("2026-01-02T12:00:00Z")), photo("jan-2", 10, Date.parse("2026-01-20T12:00:00Z")), photo("feb-1", 10, Date.parse("2026-02-02T12:00:00Z"))];
  const progress = buildMonthCleanupProgress(photos, ["jan-1"], new Map([["jan-1", 3], ["jan-2", 4], ["feb-1", 5]]), "en-US");
  assert.equal(progress[0].key, "2026-02");
  assert.equal(progress[1].reviewedCount, 1);
  assert.equal(progress[1].reclaimableMB, 7);
});
