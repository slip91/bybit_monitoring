import test from "node:test";
import assert from "node:assert/strict";

import { buildCurrentPlanDto } from "./plan-metrics";

const BASE_TIME = "2026-03-28T00:00:00.000Z";

test("returns low confidence when no active bots participate in plan", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [buildParticipant({ bot_pk: 1, is_active: 0, is_included: 1, symbol: "XRPUSDT" })],
    []
  );

  assert.equal(plan.summary.participatingBotsCount, 0);
  assert.equal(plan.summary.confidenceLevel, "low");
  assert.deepEqual(plan.summary.confidenceReasons, ["no_active_bots_in_plan"]);
  assert.equal(plan.summary.actualDailyIncome, null);
});

test("marks partial day explicitly when only a short observation window exists", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [buildParticipant({ bot_pk: 1, symbol: "SOLUSDT", equity: 365, analytics_investment: 365, grid_apr: 1 })],
    [
      buildSnapshot({ bot_pk: 1, grid_profit: 0, total_pnl: 0, equity: 365, snapshot_time: "2026-03-27T20:00:00.000Z" }),
      buildSnapshot({ bot_pk: 1, grid_profit: 1, total_pnl: 1, equity: 365, snapshot_time: "2026-03-28T06:00:00.000Z" }),
    ]
  );

  assert.equal(plan.summary.confidenceLevel, "medium");
  assert.ok(plan.summary.confidenceReasons.includes("partial_day"));
  assert.equal(plan.summary.observationCoverage, 0.4167);
  assert.equal(plan.summary.actualDailyIncome, 1);
});

test("calculates zero deficit and zero missing capital when estimate already covers target", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [
      buildParticipant({ bot_pk: 1, symbol: "BTCUSDT", equity: 3650, analytics_investment: 3650, grid_apr: 2 }),
      buildParticipant({ bot_pk: 2, symbol: "ETHUSDT", equity: 3650, analytics_investment: 3650, grid_apr: 2 }),
    ],
    [
      buildSnapshot({ bot_pk: 1, total_pnl: 0, equity: 3650, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 1, grid_profit: 10, total_pnl: 10, equity: 3650, snapshot_time: BASE_TIME }),
      buildSnapshot({ bot_pk: 2, grid_profit: 0, total_pnl: 0, equity: 3650, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 2, grid_profit: 10, total_pnl: 10, equity: 3650, snapshot_time: BASE_TIME }),
    ]
  );

  assert.equal(plan.summary.estimatedDailyIncome, 40);
  assert.equal(plan.summary.deficitToTarget, 0);
  assert.equal(plan.summary.missingCapital, 0);
  assert.ok((plan.summary.percentOfTarget ?? 0) > 1);
});

test("shows strong deficit when estimate is far below target", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 100, status: "active" },
    [buildParticipant({ bot_pk: 1, symbol: "XRPUSDT", equity: 365, analytics_investment: 365, grid_apr: 1 })],
    []
  );

  assert.equal(plan.summary.estimatedDailyIncome, 1);
  assert.equal(plan.summary.deficitToTarget, 99);
  assert.ok((plan.summary.missingCapital ?? 0) > 0);
});

test("uses runtime per day as primary estimate for plan math when available", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [
      buildParticipant({
        bot_pk: 1,
        symbol: "SOLUSDT",
        equity: 365,
        analytics_investment: 365,
        grid_apr: 10,
        grid_profit: 1.15,
        operation_time_ms: 155520000,
      }),
    ],
    []
  );

  assert.equal(plan.participants[0]?.runtimeIncomePerDay, 0.6389);
  assert.equal(plan.participants[0]?.aprIncomePerDay, 10);
  assert.equal(plan.participants[0]?.estimatedIncomePerDay, 0.6389);
  assert.equal(plan.participants[0]?.estimateSource, "runtime");
  assert.equal(plan.summary.estimatedDailyIncome, 0.6389);
});

test("exposes missing estimate and missing actual data when bot fields are incomplete", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [
      buildParticipant({ bot_pk: 1, symbol: "ADAUSDT", equity: 100, analytics_investment: 100, grid_apr: null }),
      buildParticipant({ bot_pk: 2, symbol: "DOGEUSDT", equity: 100, analytics_investment: 100, grid_apr: 1 }),
    ],
    [buildSnapshot({ bot_pk: 2, grid_profit: 2, total_pnl: 2, equity: 100, snapshot_time: BASE_TIME })]
  );

  assert.ok(plan.summary.confidenceReasons.includes("missing_estimate_data"));
  assert.equal(plan.summary.botsWithEstimateDataCount, 1);
  assert.equal(plan.summary.botsWithActualDataCount, 1);
});

test("keeps active bots outside plan separate from participating bots", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [
      buildParticipant({ bot_pk: 1, symbol: "SOLUSDT", equity: 365, analytics_investment: 365, grid_apr: 1, is_included: 1 }),
      buildParticipant({ bot_pk: 2, symbol: "XRPUSDT", equity: 365, analytics_investment: 365, grid_apr: 1, is_included: 0 }),
    ],
    [
      buildSnapshot({ bot_pk: 1, grid_profit: 0, total_pnl: 0, equity: 365, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 1, grid_profit: 1, total_pnl: 1, equity: 365, snapshot_time: BASE_TIME }),
      buildSnapshot({ bot_pk: 2, grid_profit: 0, total_pnl: 0, equity: 365, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 2, grid_profit: 20, total_pnl: 20, equity: 365, snapshot_time: BASE_TIME }),
    ]
  );

  assert.equal(plan.summary.participatingBotsCount, 1);
  assert.equal(plan.summary.allActiveBotsCount, 2);
  assert.equal(plan.summary.activeBotsOutsidePlanCount, 1);
  assert.equal(plan.summary.actualDailyIncome, 1);
  assert.equal(plan.participants.find((participant) => participant.botPk === 2)?.planCategory, "active_out_of_plan");
});

test("uses grid profit delta for current day fact and ignores total pnl drift", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [buildParticipant({ bot_pk: 1, symbol: "SOLUSDT", equity: 365, analytics_investment: 365, grid_apr: 1 })],
    [
      buildSnapshot({ bot_pk: 1, grid_profit: 1.01, total_pnl: -1.2, equity: 365, snapshot_time: "2026-03-27T20:00:00.000Z" }),
      buildSnapshot({ bot_pk: 1, grid_profit: 1.43, total_pnl: -2.8, equity: 365, snapshot_time: "2026-03-28T10:00:00.000Z" }),
    ]
  );

  assert.equal(plan.summary.actualDailyIncome, 0.42);
  assert.equal(plan.participants[0]?.actualIncomePerDay, 0.42);
});

test("uses average summed portfolio equity for performance windows instead of averaging single-bot rows", () => {
  const plan = buildCurrentPlanDto(
    { plan_pk: 1, title: "Plan", target_daily_pnl_usd: 30, status: "active" },
    [
      buildParticipant({ bot_pk: 1, bybit_bot_id: "bot-1", symbol: "SOLUSDT", equity: 240, analytics_investment: 240 }),
      buildParticipant({ bot_pk: 2, bybit_bot_id: "bot-2", symbol: "XRPUSDT", equity: 90, analytics_investment: 90 }),
      buildParticipant({ bot_pk: 3, bybit_bot_id: "bot-3", symbol: "XRPUSDT", equity: 45, analytics_investment: 45 }),
    ],
    [
      buildSnapshot({ bot_pk: 1, grid_profit: 0, equity: 240, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 2, grid_profit: 0, equity: 90, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 3, grid_profit: 0, equity: 45, snapshot_time: "2026-03-27T00:00:00.000Z" }),
      buildSnapshot({ bot_pk: 1, grid_profit: 1, equity: 246, snapshot_time: BASE_TIME }),
      buildSnapshot({ bot_pk: 2, grid_profit: 1, equity: 92, snapshot_time: BASE_TIME }),
      buildSnapshot({ bot_pk: 3, grid_profit: 1, equity: 44, snapshot_time: BASE_TIME }),
    ]
  );

  const thirtyDayWindow = plan.summary.performanceWindows.find((window) => window.key === "30d");

  assert.equal(thirtyDayWindow?.avgCapitalUsd, 378.5);
});

function buildParticipant(overrides: Record<string, unknown>) {
  return {
    bot_pk: 1,
    bybit_bot_id: "bot-1",
    is_active: 1,
    is_included: 1,
    symbol: "SOLUSDT",
    bot_type: "futures_grid",
    status: "FUTURE_GRID_STATUS_RUNNING",
    equity: 365,
    total_pnl: 0,
    total_apr: 1,
    grid_apr: 1,
    activity_count: 10,
    analytics_investment: 365,
    create_time: "2026-03-20T00:00:00.000Z",
    operation_time_ms: 86400000,
    local_peak_total_pnl: 1,
    first_seen_at: "2026-03-20T00:00:00.000Z",
    last_seen_at: BASE_TIME,
    last_snapshot_at: BASE_TIME,
    confirmed_at: "2026-03-20T00:00:00.000Z",
    weight: 1,
    membership_updated_at: BASE_TIME,
    ...overrides,
  };
}

function buildSnapshot(overrides: Record<string, unknown>) {
  return {
    bot_pk: 1,
    grid_profit: 0,
    total_pnl: 0,
    equity: 365,
    snapshot_time: BASE_TIME,
    ...overrides,
  };
}
