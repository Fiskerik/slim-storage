import assert from "node:assert/strict";
import test from "node:test";

const { localDayBounds, localDayKey } = await import("../lib/daily-cleanup-calendar.ts");

test("local day bounds use midnight and the next calendar midnight", () => {
  const now = new Date(2026, 7, 16, 20, 30, 0);
  const { start, end } = localDayBounds(now);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 16);
  assert.equal(end.getHours(), 0);
  assert.equal(end.getDate(), 17);
  assert.equal(localDayKey(now), "2026-08-16");
});

test("local day key follows the device calendar rather than UTC", () => {
  const lateLocalDate = new Date(2026, 0, 2, 0, 15);
  assert.equal(localDayKey(lateLocalDate), "2026-01-02");
});
