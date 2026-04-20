import test from "node:test";
import assert from "node:assert/strict";

import { buildClosedBotsDto } from "./closed-bots-metrics";

test("builds closed bots summary and profitability split", () => {
  const dto = buildClosedBotsDto(
    {
      closed_bots_count: 3,
      total_final_pnl: 4.5,
      total_realized_pnl: null,
      profitable_closed_bots: 2,
      losing_closed_bots: 1,
      avg_pnl_per_100_usd: 1.5,
      avg_pnl_per_day: 0.42,
      avg_lifetime_days: null,
      realized_pnl_coverage_ratio: 0,
      lifetime_coverage_ratio: 0,
      close_reason_coverage_ratio: 0,
      strategy_tag_coverage_ratio: 0,
      excluded_runs_count: 1,
    },
    [
      {
        closed_run_pk: 1,
        legacy_bot_id: "a",
        symbol: "SOLUSDT",
        total_pnl: 3.2,
        lifetime_days: 4,
        snapshot_count: 1,
        source: "completed",
        exclude_from_closed_stats: 0,
      },
      {
        closed_run_pk: 2,
        legacy_bot_id: "b",
        symbol: "XRPUSDT",
        total_pnl: -0.7,
        lifetime_days: 2,
        snapshot_count: 2,
        source: "completed",
        exclude_from_closed_stats: 1,
        exclude_reason: "duplicate",
      },
      {
        closed_run_pk: 3,
        legacy_bot_id: "c",
        symbol: "BNBUSDT",
        total_pnl: 2.0,
        lifetime_days: 5,
        snapshot_count: 3,
        source: "completed",
        exclude_from_closed_stats: 0,
      },
    ]
  );

  assert.equal(dto.summary.closedBotsCount, 3);
  assert.equal(dto.summary.totalFinalPnl, 4.5);
  assert.equal(dto.summary.realizedPnlStatus, "unavailable");
  assert.equal(dto.summary.excludedRunsCount, 1);
  assert.equal(dto.summary.usesFinalPnlProxy, true);
  assert.equal(dto.summary.profitableClosedBots, 2);
  assert.equal(dto.summary.losingClosedBots, 1);
  assert.equal(dto.summary.avgPnlPer100Usd, 1.5);
  assert.equal(dto.summary.avgPnlPerDay, 0.42);
  assert.equal(dto.items[0].profitabilityStatus, "profit");
  assert.equal(dto.items[0].averagePnlPerDay, 0.8);
  assert.equal(dto.items[1].profitabilityStatus, "loss");
  assert.equal(dto.items[1].excludeFromClosedStats, true);
  assert.equal(dto.items[1].excludeReason, "duplicate");
  assert.equal(dto.items[0].realizedPnlStatus, "unavailable");
  assert.equal(dto.items[0].lifetimeStatus, "available");
});
