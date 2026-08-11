import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConservativeCaptureGroups,
  buildSimilarityCandidateGroups,
  clusterVerifiedSimilarityPairs,
  selectSimilarityRemovals,
} from "../lib/photo-similarity.ts";
import {
  hasReachedMidset,
  midsetHoldSeconds,
  shouldPresentMidsetAd,
} from "../lib/swipe-midset.ts";

function item(id, seconds, sizeMB = 3, width = 4032, height = 3024) {
  return { id, creationTime: seconds * 1000, width, height, sizeMB };
}

test("coarse candidates are not promoted by the conservative fallback", () => {
  const items = [item("a", 100, 3), item("b", 140, 3.3)];
  assert.equal(buildSimilarityCandidateGroups(items).length, 1);
  assert.equal(buildConservativeCaptureGroups(items).length, 0);
});

test("verified grouping rejects transitive similarity chains", () => {
  const candidates = [[item("a", 100), item("b", 99), item("c", 98)]];
  const groups = clusterVerifiedSimilarityPairs(candidates, [
    { firstAssetId: "a", secondAssetId: "b", distance: 3 },
    { firstAssetId: "b", secondAssetId: "c", distance: 3 },
  ]);
  assert.deepEqual(groups.map((group) => group.map(({ id }) => id)), [["a", "b"]]);
});

test("similarity savings preserve the largest likely keeper", () => {
  const result = selectSimilarityRemovals([
    [item("small", 98, 2), item("keeper", 100, 5), item("medium", 99, 3)],
  ]);
  assert.deepEqual([...result.removalIds].sort(), ["medium", "small"]);
  assert.equal(result.savingsMB, 5);
});

test("mid-set ad appears only at the actual midpoint for free users", () => {
  const base = {
    initialCount: 10,
    isPro: false,
    dismissed: false,
    loaded: true,
    hasCurrentPhoto: true,
  };
  assert.equal(shouldPresentMidsetAd({ ...base, remainingCount: 6 }), false);
  assert.equal(shouldPresentMidsetAd({ ...base, remainingCount: 5 }), true);
  assert.equal(shouldPresentMidsetAd({ ...base, remainingCount: 5, isPro: true }), false);
  assert.equal(shouldPresentMidsetAd({ ...base, remainingCount: 5, dismissed: true }), false);
  assert.equal(shouldPresentMidsetAd({ ...base, remainingCount: 5, loaded: false }), false);
  assert.equal(
    shouldPresentMidsetAd({ ...base, initialCount: 9, remainingCount: 5 }),
    false,
  );
  assert.equal(
    shouldPresentMidsetAd({ ...base, initialCount: 9, remainingCount: 4 }),
    true,
  );
});

test("mid-set threshold handles even and odd set sizes", () => {
  assert.equal(hasReachedMidset(10, 6), false);
  assert.equal(hasReachedMidset(10, 5), true);
  assert.equal(hasReachedMidset(9, 5), false);
  assert.equal(hasReachedMidset(9, 4), true);
  assert.equal(hasReachedMidset(1, 0), false);
});

test("mid-set hold duration stays within the requested eight-to-twelve-second window", () => {
  assert.equal(midsetHoldSeconds(0), 8);
  assert.equal(midsetHoldSeconds(0.5), 10);
  assert.equal(midsetHoldSeconds(1), 12);
});
