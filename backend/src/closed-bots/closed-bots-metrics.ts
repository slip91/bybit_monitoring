type RawRow = Record<string, unknown>;

export function buildClosedBotsDto(summaryRow: RawRow | null, itemRows: RawRow[]) {
  const items = itemRows.map((row) => {
    const realizedPnl = toNullableNumber(row.realized_pnl);
    const unrealizedPnl = toNullableNumber(row.unrealized_pnl);
    const totalPnl = toNullableNumber(row.total_pnl);
    const finalPnl = totalPnl ?? realizedPnl;
    const lifetimeDays = toNullableNumber(row.lifetime_days);
    const averagePnlPerDay =
      finalPnl !== null && lifetimeDays !== null && lifetimeDays > 0 ? toNullableNumber(finalPnl / lifetimeDays) : null;

    return {
      closedRunPk: toNumber(row.closed_run_pk),
      legacyBotId: asString(row.legacy_bot_id) || `closed:${toNumber(row.closed_run_pk)}`,
      botPk: toNullableNumber(row.bot_pk),
      symbol: asString(row.symbol),
      botType: asString(row.bot_type) || "futures_grid",
      leverage: toNullableNumber(row.leverage),
      strategyTag: asString(row.strategy_tag),
      closeReason: asString(row.close_reason),
      closeReasonDetail: asString(row.close_reason_detail),
      startedAt: asString(row.started_at),
      closedAt: asString(row.closed_at),
      firstObservedAt: asString(row.first_observed_at),
      lastObservedAt: asString(row.last_observed_at),
      snapshotCount: toNumber(row.snapshot_count),
      investment: toNullableNumber(row.investment),
      realizedPnl,
      realizedPnlStatus: deriveFieldStatus(realizedPnl),
      unrealizedPnl,
      totalPnl,
      finalPnl,
      averagePnlPerDay,
      equityAtClose: toNullableNumber(row.equity_at_close),
      lifetimeDays,
      lifetimeStatus: deriveFieldStatus(lifetimeDays),
      source: asString(row.source) || "completed_fgrid_history",
      profitabilityStatus: computeProfitabilityStatus(finalPnl),
      closeReasonStatus: deriveFieldStatus(asString(row.close_reason)),
      strategyTagStatus: deriveFieldStatus(asString(row.strategy_tag)),
      excludeFromPeriodStats: toBoolean(row.exclude_from_period_stats),
      excludeFromClosedStats: toBoolean(row.exclude_from_closed_stats),
      excludeReason: asString(row.exclude_reason),
      excludeNote: asString(row.exclude_note),
    };
  });

  const realizedCoverageRatio = toNullableNumber(summaryRow?.realized_pnl_coverage_ratio);
  const lifetimeCoverageRatio = toNullableNumber(summaryRow?.lifetime_coverage_ratio);
  const closeReasonCoverageRatio = toNullableNumber(summaryRow?.close_reason_coverage_ratio);
  const strategyTagCoverageRatio = toNullableNumber(summaryRow?.strategy_tag_coverage_ratio);

  return {
    summary: {
      closedBotsCount: toNumber(summaryRow?.closed_bots_count),
      totalFinalPnl: toNullableNumber(summaryRow?.total_final_pnl),
      totalRealizedPnl: toNullableNumber(summaryRow?.total_realized_pnl),
      profitableClosedBots: toNumber(summaryRow?.profitable_closed_bots),
      losingClosedBots: toNumber(summaryRow?.losing_closed_bots),
      avgPnlPer100Usd: toNullableNumber(summaryRow?.avg_pnl_per_100_usd),
      avgPnlPerDay: toNullableNumber(summaryRow?.avg_pnl_per_day),
      avgLifetimeDays: toNullableNumber(summaryRow?.avg_lifetime_days),
      realizedPnlCoverageRatio: realizedCoverageRatio,
      lifetimeCoverageRatio,
      closeReasonCoverageRatio,
      strategyTagCoverageRatio,
      realizedPnlStatus: deriveCoverageStatus(realizedCoverageRatio),
      lifetimeStatus: deriveCoverageStatus(lifetimeCoverageRatio),
      closeReasonStatus: deriveCoverageStatus(closeReasonCoverageRatio),
      strategyTagStatus: deriveCoverageStatus(strategyTagCoverageRatio),
      excludedRunsCount: toNumber(summaryRow?.excluded_runs_count),
      usesFinalPnlProxy:
        (toNumber(summaryRow?.closed_bots_count) > 0 && (realizedCoverageRatio ?? 0) < 1) ||
        toNullableNumber(summaryRow?.total_realized_pnl) === null,
    },
    items,
  };
}

function computeProfitabilityStatus(finalPnl: number | null) {
  if (finalPnl === null) {
    return "unknown";
  }
  if (finalPnl > 0) {
    return "profit";
  }
  if (finalPnl < 0) {
    return "loss";
  }
  return "flat";
}

function deriveCoverageStatus(value: number | null) {
  if (value === null || value <= 0) {
    return "unavailable";
  }
  if (value >= 0.999) {
    return "available";
  }
  return "incomplete";
}

function deriveFieldStatus(value: number | string | null) {
  return value === null ? "unavailable" : "available";
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10000) / 10000 : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown) {
  if (value === true || value === 1 || value === "1") {
    return true;
  }
  return false;
}
