import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConservativeCaptureGroups,
  buildSimilarityCandidateGroups,
  clusterVerifiedSimilarityPairs,
  selectSimilarityRemovals,
} from "../lib/photo-similarity.ts";

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
