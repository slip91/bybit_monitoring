function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFGridDetail(detail) {
  return {
    bot_id: String(detail.bot_id),
    symbol: detail.symbol || null,
    status: detail.status || null,
    investment: detail.total_investment || null,
    realized_pnl: detail.realised_pnl || null,
    unrealized_pnl: detail.unrealised_pnl || null,
    total_pnl: detail.pnl || null,
    grid_profit: detail.grid_profit || null,
    leverage: detail.leverage || detail.real_leverage || null,
    apr: detail.total_apr || null,
    total_apr: detail.total_apr || null,
    grid_apr: detail.grid_apr || null,
    funding_fees: detail.funding_fee || null,
    liquidation_price: detail.liquidation_price || null,
    arbitrage_count: numberOrNull(detail.arbitrage_num),
    equity: detail.equity || null,
    total_order_balance: detail.total_order_balance || null,
    available_balance: detail.available_balance || null,
    position_balance: detail.position_balance || null,
    create_time: detail.create_time || null,
    operation_time: detail.operation_time || null,
    modify_time: detail.modify_time || null,
    end_time: detail.end_time || null,
  };
}

function buildCompletedSnapshot(detail) {
  return {
    investment: detail.investment,
    realized_pnl: detail.realized_pnl,
    unrealized_pnl: detail.unrealized_pnl,
    total_pnl: detail.total_pnl,
    apr: detail.apr,
    funding_fees: detail.funding_fees,
    liquidation_price: detail.liquidation_price,
    arbitrage_count: detail.arbitrage_count,
    equity: detail.equity,
  };
}

function buildActiveBotReportRow(detail) {
  const row = withBotAnalytics({
    bot_id: detail.bot_id,
    symbol: detail.symbol,
    status: detail.status,
    equity: detail.equity,
    total_apr: detail.total_apr,
    grid_apr: detail.grid_apr,
    total_pnl: detail.total_pnl,
    realized_pnl: detail.realized_pnl,
    unrealized_pnl: detail.unrealized_pnl,
    arbitrage_count: detail.arbitrage_count ?? "",
    total_order_balance: detail.total_order_balance ?? "",
    available_balance: detail.available_balance ?? "",
    position_balance: detail.position_balance ?? "",
    local_peak_total_pnl: detail.local_peak_total_pnl ?? null,
  });

  const { local_peak_total_pnl: _localPeakTotalPnl, ...reportRow } = row;
  return reportRow;
}

function buildActiveBotSnapshotRecord(inventoryBot, detail, snapshotTime, errorMessage) {
  const payload = errorMessage
    ? JSON.stringify({
        error: errorMessage,
        inventory_bot: inventoryBot,
      })
    : JSON.stringify(detail);

  return {
    bybit_bot_id: inventoryBot.bot_id,
    symbol: detail?.symbol ?? inventoryBot.symbol ?? null,
    bot_type: inventoryBot.bot_type ?? null,
    status: detail?.status ?? inventoryBot.status ?? null,
    route: inventoryBot.route ?? null,
    source: inventoryBot.source || "active-bot-snapshot",
    snapshot_time: snapshotTime,
    equity: detail?.equity ?? null,
    total_pnl: detail?.total_pnl ?? null,
    total_apr: detail?.total_apr ?? detail?.apr ?? null,
    grid_apr: detail?.grid_apr ?? null,
    grid_profit: detail?.grid_profit ?? null,
    leverage: detail?.leverage ?? detail?.real_leverage ?? null,
    activity_count: detail?.arbitrage_count ?? null,
    investment: detail?.investment ?? null,
    realized_pnl: detail?.realized_pnl ?? null,
    unrealized_pnl: detail?.unrealized_pnl ?? null,
    funding_fees: detail?.funding_fees ?? null,
    liquidation_price: detail?.liquidation_price ?? null,
    total_order_balance: detail?.total_order_balance ?? null,
    available_balance: detail?.available_balance ?? null,
    position_balance: detail?.position_balance ?? null,
    create_time: epochMsToIso(detail?.create_time),
    operation_time_ms: numberOrNull(detail?.operation_time),
    modify_time: epochMsToIso(detail?.modify_time),
    end_time: epochMsToIso(detail?.end_time),
    raw_payload_json: payload,
  };
}

function withBotAnalytics(record) {
  const totalApr = numberOrNull(record.total_apr);
  const gridApr = numberOrNull(record.grid_apr);
  const totalPnl = numberOrNull(record.total_pnl);
  const equity = numberOrNull(record.equity);
  const investment = numberOrNull(record.investment);
  const activityCount = numberOrNull(record.activity_count ?? record.arbitrage_count);
  const localPeakTotalPnl = numberOrNull(record.local_peak_total_pnl);
  const runtimeStartedAt =
    record.runtime_started_at ?? record.confirmed_at ?? record.first_seen_at ?? record.discovered_at ?? null;
  const runtimeEndedAt = record.runtime_ended_at ?? record.snapshot_time ?? record.last_snapshot_at ?? null;

  const pnlGap = computePnlGap(totalApr, gridApr);
  const pnlToEquityRatio = computePnlToEquityRatio(totalPnl, equity);
  const activityScore = computeActivityScore(activityCount, totalApr, gridApr);
  const drawdownFromLocalPeak = computeDrawdownFromLocalPeak(totalPnl, localPeakTotalPnl);
  const runtimeSec = computeRuntimeSec(runtimeStartedAt, runtimeEndedAt);
  const runtimeDays = runtimeSec === null ? null : roundMetric(runtimeSec / 86400);
  const workRuntimeSec = computeWorkRuntimeSec(record);
  const annualizedRuntimeSec = workRuntimeSec ?? runtimeSec;
  const annualizedRuntimeDaysExact = annualizedRuntimeSec === null ? null : annualizedRuntimeSec / 86400;
  const annualizedCapitalBase = equity ?? investment;
  const derivedAnnualizedTotalYieldRatio = computeDerivedAnnualizedTotalYieldRatio(
    totalPnl,
    annualizedCapitalBase,
    annualizedRuntimeSec,
  );
  const derivedAnnualizedStatus = computeDerivedAnnualizedStatus(annualizedRuntimeDaysExact);
  const gridProfitPerDay = computeGridProfitPerDay(gridApr, investment ?? equity);
  const factPnlPerDay = computeFactPnlPerDay(numberOrNull(record.grid_profit), workRuntimeSec ?? runtimeSec);
  const statusHint = computeStatusHint({
    totalPnl,
    gridApr,
    pnlGap,
    pnlToEquityRatio,
    activityCount,
    drawdownFromLocalPeak,
    localPeakTotalPnl,
  });

  return {
    ...record,
    pnl_gap: pnlGap,
    pnl_to_equity_ratio: pnlToEquityRatio,
    activity_score: activityScore,
    drawdown_from_local_peak: drawdownFromLocalPeak,
    runtime_started_at: runtimeStartedAt,
    runtime_sec: runtimeSec,
    runtime_days: runtimeDays,
    annualized_runtime_sec: annualizedRuntimeSec,
    annualized_runtime_days: roundMetric(annualizedRuntimeDaysExact),
    annualized_capital_base: roundMetric(annualizedCapitalBase),
    derived_annualized_total_yield_ratio: derivedAnnualizedTotalYieldRatio,
    derived_annualized_status: derivedAnnualizedStatus,
    grid_profit_per_day: gridProfitPerDay,
    fact_pnl_per_day: factPnlPerDay,
    status_hint: statusHint,
  };
}

function computePnlGap(totalApr, gridApr) {
  if (totalApr === null || gridApr === null) {
    return null;
  }

  return roundMetric(totalApr - gridApr);
}

function computePnlToEquityRatio(totalPnl, equity) {
  if (totalPnl === null || equity === null || equity === 0) {
    return null;
  }

  return roundMetric(totalPnl / equity);
}

function computeActivityScore(activityCount, totalApr, gridApr) {
  if (activityCount === null) {
    return null;
  }

  const aprBasis = gridApr ?? totalApr ?? 0;
  return roundMetric(Math.log1p(Math.max(activityCount, 0)) * aprBasis);
}

function computeDrawdownFromLocalPeak(totalPnl, localPeakTotalPnl) {
  if (totalPnl === null || localPeakTotalPnl === null) {
    return null;
  }

  return roundMetric(Math.max(0, localPeakTotalPnl - totalPnl));
}

function computeRuntimeSec(startedAt, endedAt) {
  if (!startedAt) {
    return null;
  }

  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs)) {
    return null;
  }

  const endedMs = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(endedMs) || endedMs < startedMs) {
    return null;
  }

  return Math.round((endedMs - startedMs) / 1000);
}

function computeWorkRuntimeSec(record) {
  const directRuntimeSec = numberOrNull(record.work_runtime_sec);
  if (directRuntimeSec !== null && directRuntimeSec > 0) {
    return Math.round(directRuntimeSec);
  }

  const operationTimeMs = numberOrNull(record.operation_time_ms ?? record.operation_time);
  if (operationTimeMs !== null && operationTimeMs > 0) {
    return Math.round(operationTimeMs / 1000);
  }

  const workStartedAt = normalizeTimeValue(record.work_started_at ?? record.create_time);
  const workEndedAt = normalizeTimeValue(record.work_ended_at ?? record.end_time ?? record.snapshot_time ?? record.last_snapshot_at);

  if (!workStartedAt || !workEndedAt) {
    return null;
  }

  return computeRuntimeSec(workStartedAt, workEndedAt);
}

function normalizeTimeValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function computeGridProfitPerDay(gridApr, capitalBase) {
  if (gridApr === null || capitalBase === null) {
    return null;
  }

  return roundMetric((capitalBase * gridApr) / 365);
}

function computeFactPnlPerDay(gridProfit, runtimeSec) {
  if (gridProfit === null || runtimeSec === null || runtimeSec <= 0) {
    return null;
  }

  return roundMetric(gridProfit / (runtimeSec / 86400));
}

function computeDerivedAnnualizedTotalYieldRatio(totalPnl, capitalBase, runtimeSec) {
  if (totalPnl === null || capitalBase === null || capitalBase <= 0 || runtimeSec === null || runtimeSec <= 0) {
    return null;
  }

  const runtimeDaysExact = runtimeSec / 86400;
  if (!Number.isFinite(runtimeDaysExact) || runtimeDaysExact <= 0) {
    return null;
  }

  return roundMetric((totalPnl / capitalBase) * (365 / runtimeDaysExact));
}

function computeDerivedAnnualizedStatus(runtimeDaysExact) {
  if (runtimeDaysExact === null || !Number.isFinite(runtimeDaysExact) || runtimeDaysExact <= 0) {
    return "unavailable";
  }

  if (runtimeDaysExact < 1) {
    return "unstable";
  }

  if (runtimeDaysExact < 7) {
    return "preliminary";
  }

  return "stable";
}

function computeStatusHint({
  totalPnl,
  gridApr,
  pnlGap,
  pnlToEquityRatio,
  activityCount,
  drawdownFromLocalPeak,
  localPeakTotalPnl,
}) {
  if (isHighDrawdown(drawdownFromLocalPeak, localPeakTotalPnl)) {
    return "high_drawdown";
  }

  if (activityCount !== null && activityCount < 3) {
    return "weak_activity";
  }

  if (gridApr !== null && gridApr > 0 && pnlGap !== null && pnlGap < 0) {
    return "grid_works_position_hurts";
  }

  if ((pnlToEquityRatio !== null && pnlToEquityRatio >= 0) || (totalPnl !== null && totalPnl >= 0)) {
    return "overall_green";
  }

  return "unknown";
}

function isHighDrawdown(drawdownFromLocalPeak, localPeakTotalPnl) {
  if (drawdownFromLocalPeak === null) {
    return false;
  }

  if (drawdownFromLocalPeak >= 5) {
    return true;
  }

  if (localPeakTotalPnl === null || localPeakTotalPnl <= 0) {
    return false;
  }

  if (drawdownFromLocalPeak < 1) {
    return false;
  }

  return drawdownFromLocalPeak / localPeakTotalPnl >= 0.3;
}

function roundMetric(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}

function epochMsToIso(value) {
  const timestamp = numberOrNull(value);
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

module.exports = {
  buildActiveBotReportRow,
  buildActiveBotSnapshotRecord,
  buildCompletedSnapshot,
  computeActivityScore,
  computeDrawdownFromLocalPeak,
  computeFactPnlPerDay,
  computeDerivedAnnualizedTotalYieldRatio,
  computePnlGap,
  computePnlToEquityRatio,
  computeGridProfitPerDay,
  computeRuntimeSec,
  computeStatusHint,
  normalizeFGridDetail,
  numberOrNull,
  withBotAnalytics,
};
