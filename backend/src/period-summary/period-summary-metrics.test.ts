import test from "node:test";
import assert from "node:assert/strict";

import { buildPeriodSummaryDto } from "./period-summary-metrics";

test("builds combined period summary with proxy and coverage states", () => {
  const dto = buildPeriodSummaryDto({
    windowKey: "7d",
    composition: "combined",
    boundsRow: {
      active_min_snapshot_time: "2026-03-27T17:00:00.000Z",
      active_max_snapshot_time: "2026-03-27T21:00:00.000Z",
      closed_min_time: "2026-03-27 15:00:00",
      closed_max_time: "2026-03-27 15:00:00",
    },
    activeRows: [
      {
        bot_pk: 1,
        bybit_bot_id: "active-1",
        symbol: "SOLUSDT",
        bot_type: "futures_grid",
        snapshot_time: "2026-03-27T17:00:00.000Z",
        total_pnl: 10,
        realized_pnl: 2,
        exclude_from_period_stats: 0,
      },
      {
        bot_pk: 1,
        bybit_bot_id: "active-1",
        symbol: "SOLUSDT",
        bot_type: "futures_grid",
        snapshot_time: "2026-03-27T21:00:00.000Z",
        total_pnl: 13,
        realized_pnl: 4,
        exclude_from_period_stats: 0,
      },
    ],
    closedRows: [
      {
        closed_run_pk: 11,
        legacy_bot_id: "closed-11",
        symbol: "BTCUSDT",
        bot_type: "futures_grid",
        closed_at: "2026-03-27 15:00:00",
        realized_pnl: null,
        total_pnl: -1.5,
        lifetime_days: null,
        exclude_from_period_stats: 0,
        exclude_from_closed_stats: 0,
      },
    ],
  });

  assert.equal(dto.summary.combinedPnl, 1.5);
  assert.equal(dto.summary.netPnl, 1.5);
  assert.equal(dto.summary.realizedPnl, 2);
  assert.equal(dto.summary.botsInvolvedCount, 2);
  assert.equal(dto.summary.closedBotsCount, 1);
  assert.equal(dto.summary.profitableBotsCount, 1);
  assert.equal(dto.summary.losingBotsCount, 1);
  assert.equal(dto.summary.averagePnlPerDayStatus, "unavailable");
  assert.equal(dto.summary.confidenceLevel, "low");
  assert.equal(dto.summary.excludedBotsCount, 0);
  assert.equal(dto.summary.excludedRunsCount, 0);
  assert.equal(dto.summary.realizedPnlStatus, "incomplete");
  assert.equal(dto.summary.lifetimeStatus, "unavailable");
  assert.equal(dto.summary.usesFinalPnlProxy, true);
  assert.equal(dto.summary.bestBot?.botId, "active-1");
  assert.equal(dto.summary.worstBot?.botId, "closed-11");
});

test("excludes rows from period summary aggregates when exclusion flag is set", () => {
  const dto = buildPeriodSummaryDto({
    windowKey: "1d",
    composition: "combined",
    boundsRow: {
      active_min_snapshot_time: "2026-03-27T00:00:00.000Z",
      active_max_snapshot_time: "2026-03-27T12:00:00.000Z",
      closed_min_time: "2026-03-27 12:00:00",
      closed_max_time: "2026-03-27 12:00:00",
    },
    activeRows: [
      {
        bot_pk: 1,
        bybit_bot_id: "active-1",
        symbol: "SOLUSDT",
        bot_type: "futures_grid",
        snapshot_time: "2026-03-27T00:00:00.000Z",
        total_pnl: 0,
        realized_pnl: 0,
        exclude_from_period_stats: 1,
        exclude_reason: "manual_ignore",
      },
      {
        bot_pk: 1,
        bybit_bot_id: "active-1",
        symbol: "SOLUSDT",
        bot_type: "futures_grid",
        snapshot_time: "2026-03-27T12:00:00.000Z",
        total_pnl: 5,
        realized_pnl: 4,
        exclude_from_period_stats: 1,
        exclude_reason: "manual_ignore",
      },
    ],
    closedRows: [
      {
        closed_run_pk: 22,
        legacy_bot_id: "closed-22",
        symbol: "BTCUSDT",
        bot_type: "futures_grid",
        closed_at: "2026-03-27 12:00:00",
        realized_pnl: 3,
        total_pnl: 3,
        lifetime_days: 2,
        exclude_from_period_stats: 0,
        exclude_from_closed_stats: 0,
      },
    ],
  });

  assert.equal(dto.summary.combinedPnl, 3);
  assert.equal(dto.summary.netPnl, 3);
  assert.equal(dto.summary.realizedPnl, 3);
  assert.equal(dto.summary.botsInvolvedCount, 1);
  assert.equal(dto.summary.activeBotsCount, 0);
  assert.equal(dto.summary.closedBotsCount, 1);
  assert.equal(dto.summary.excludedBotsCount, 1);
  assert.equal(dto.summary.excludedRunsCount, 0);
  assert.equal(dto.items[0].excludeFromPeriodStats, true);
  assert.equal(dto.items[0].excludeReason, "manual_ignore");
  assert.equal(dto.summary.notes.includes("excluded_records_impact"), true);
});
