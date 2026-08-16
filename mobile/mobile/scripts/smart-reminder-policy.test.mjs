import assert from "node:assert/strict";
import test from "node:test";

const { chooseSmartReminder, smartReminderCapAllows, withinSmartQuietHours } =
  await import("../lib/smart-reminder-policy.ts");

const preferences = { enabled: true, streak: true, storage: true, newPhotos: true, cleanup: true, weekly: true };
const snapshot = {
  capturedAt: "2026-08-12T17:00:00.000Z",
  photoCount: 40,
  totalSizeMB: 300,
  freeSpaceMB: 40,
  deviceCapacityMB: 1000,
  screenshotsCount: 60,
  screenshotsMB: 120,
  similarCount: 25,
  similarMB: 180,
  trimSavingsMB: 600,
  deleteSavingsMB: 0,
};

function stats(reviewed = 1) {
  return {
    reviewed,
    actionLog: [{ createdAt: "2026-08-01T12:00:00.000Z" }],
    dailyActivity: { "2026-08-11": { reviewed: 1 }, "2026-08-12": { reviewed: 0 } },
  };
}

test("low storage wins over lower-priority opportunities", () => {
  const candidate = chooseSmartReminder(stats(), snapshot, preferences, new Date("2026-08-12T18:00:00.000Z"));
  assert.equal(candidate?.trigger, "low-storage");
  assert.equal(candidate?.priority, 100);
});

test("stale snapshots are suppressed", () => {
  const stale = { ...snapshot, capturedAt: "2026-08-08T00:00:00.000Z" };
  assert.equal(chooseSmartReminder(stats(), stale, preferences, new Date("2026-08-12T18:00:00.000Z")), null);
});

test("quiet hours and rolling cap are enforced", () => {
  assert.equal(withinSmartQuietHours(new Date(2026, 7, 12, 8, 59)), false);
  assert.equal(withinSmartQuietHours(new Date(2026, 7, 12, 9, 0)), true);
  assert.equal(smartReminderCapAllows("2026-08-10T12:00:00.000Z", new Date("2026-08-12T11:59:00.000Z")), false);
  assert.equal(smartReminderCapAllows("2026-08-09T12:00:00.000Z", new Date("2026-08-12T12:00:00.000Z")), true);
});
