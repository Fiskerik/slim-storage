import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhotoProtectionStore, setPhotoProtection, protectedPhotoIds } from "../lib/photo-protection-policy.ts";

test("protection store normalizes malformed records and persists explicit protection", () => {
  const normalized = normalizePhotoProtectionStore({ records: { keep: { protectedAt: "not-a-date" }, bad: null } });
  assert.deepEqual([...protectedPhotoIds(normalized)], ["keep"]);
  const next = setPhotoProtection(normalized, "photo-2", true, "decide-later");
  assert.equal(next.records["photo-2"].reason, "decide-later");
  const unprotected = setPhotoProtection(next, "keep", false);
  assert.deepEqual([...protectedPhotoIds(unprotected)], ["photo-2"]);
});
