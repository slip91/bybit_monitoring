const test = require("node:test");
const assert = require("node:assert/strict");

const { computeStatusHint } = require("./fgrid");

test("does not mark tiny pullback from a small local peak as high drawdown", () => {
  const statusHint = computeStatusHint({
    totalPnl: 0.44,
    gridApr: 1.2231,
    pnlGap: -1,
    pnlToEquityRatio: 0.0018,
    activityCount: 60,
    drawdownFromLocalPeak: 0.33,
    localPeakTotalPnl: 0.77,
  });

  assert.equal(statusHint, "grid_works_position_hurts");
});

test("keeps high drawdown for materially large absolute drawdown", () => {
  const statusHint = computeStatusHint({
    totalPnl: 8,
    gridApr: 0.5,
    pnlGap: -0.1,
    pnlToEquityRatio: 0.02,
    activityCount: 20,
    drawdownFromLocalPeak: 5,
    localPeakTotalPnl: 12,
  });

  assert.equal(statusHint, "high_drawdown");
});
