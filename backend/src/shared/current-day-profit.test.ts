import assert from "node:assert/strict";
import test from "node:test";

import { computeGridProfitDeltaSinceWindowStart, startOfLocalDayMs } from "./current-day-profit";

test("uses latest minus baseline when day-start anchor exists", () => {
  const windowStartMs = Date.parse("2026-03-28T00:00:00.000Z");

  assert.equal(
    computeGridProfitDeltaSinceWindowStart({
      baselineGridProfit: 1.01,
      latestGridProfit: 1.43,
      startedAtMs: Date.parse("2026-03-20T00:00:00.000Z"),
      windowStartMs,
    }),
    0.42,
  );
});

test("falls back to full latest grid profit when bot started today", () => {
  const windowStartMs = Date.parse("2026-03-28T00:00:00.000Z");

  assert.equal(
    computeGridProfitDeltaSinceWindowStart({
      baselineGridProfit: null,
      latestGridProfit: 0.56,
      startedAtMs: Date.parse("2026-03-28T09:10:00.000Z"),
      windowStartMs,
    }),
    0.56,
  );
});

test("falls back to first in-window snapshot when earlier baseline is missing", () => {
  const windowStartMs = Date.parse("2026-03-28T00:00:00.000Z");

  assert.equal(
    computeGridProfitDeltaSinceWindowStart({
      baselineGridProfit: null,
      firstWindowGridProfit: 1.01,
      latestGridProfit: 1.43,
      startedAtMs: Date.parse("2026-03-20T09:10:00.000Z"),
      windowStartMs,
    }),
    0.42,
  );
});

test("builds local-day boundary from reference time", () => {
  const referenceMs = new Date("2026-03-28T16:45:12.000").getTime();

  assert.equal(new Date(startOfLocalDayMs(referenceMs)).getHours(), 0);
  assert.equal(new Date(startOfLocalDayMs(referenceMs)).getMinutes(), 0);
});
