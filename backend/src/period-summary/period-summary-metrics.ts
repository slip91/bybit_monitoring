type RawRow = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PeriodWindowKey = "1d" | "7d" | "30d" | "90d" | "500d" | "all";
export type SummaryComposition = "active" | "combined" | "closed";
type CoverageStatus = "available" | "incomplete" | "unavailable";
type SourceKind = "active" | "closed";

type SourceBounds = {
  activeMinSnapshotTime: string | null;
  activeMaxSnapshotTime: string | null;
  closedMinTime: string | null;
  closedMaxTime: string | null;
};

type SummaryItem = {
  key: string;
  sourceKind: SourceKind;
  botId: string;
  symbol: string | null;
  botType: string | null;
  leverage: number | null;
  currentStatus: "active" | "closed";
  periodPnl: number | null;
  realizedPnl: number | null;
  combinedPnl: number | null;
  averagePnlPerDay: number | null;
  observedDays: number | null;
  closedAt: string | null;
  lifetimeDays: number | null;
  realizedPnlStatus: CoverageStatus;
  lifetimeStatus: CoverageStatus;
  dataQualityStatus: CoverageStatus;
  excludeFromPeriodStats: boolean;
  excludeFromClosedStats: boolean;
  excludeReason: string | null;
  excludeNote: string | null;
  profitabilityStatus: "profit" | "loss" | "flat" | "unknown";
};

const WINDOW_CONFIGS: Record<
  PeriodWindowKey,
  { key: PeriodWindowKey; label: string; requestedDays: number | null }
> = {
  "1d": { key: "1d", label: "1 день", requestedDays: 1 },
  "7d": { key: "7d", label: "7 дней", requestedDays: 7 },
  "30d": { key: "30d", label: "30 дней", requestedDays: 30 },
  "90d": { key: "90d", label: "90 дней", requestedDays: 90 },
  "500d": { key: "500d", label: "500 дней", requestedDays: 500 },
  all: { key: "all", label: "Все время", requestedDays: null },
};

export function buildPeriodSummaryDto(args: {
  windowKey: PeriodWindowKey;
  composition: SummaryComposition;
  boundsRow: RawRow | null;
  activeRows: RawRow[];
  closedRows: RawRow[];
}) {
  const bounds = normalizeBounds(args.boundsRow);
  const includeActive = args.composition === "active" || args.composition === "combined";
  const includeClosed = args.composition === "closed" || args.composition === "combined";
  const latestTimestampMs = getLatestTimestampMs(bounds, includeActive, includeClosed);
  const windowConfig = WINDOW_CONFIGS[args.windowKey];
  const periodStartMs =
    windowConfig.requestedDays === null || latestTimestampMs === null
      ? null
      : latestTimestampMs - windowConfig.requestedDays * DAY_MS;
  const periodStart = periodStartMs === null ? null : new Date(periodStartMs).toISOString();
  const periodEnd = latestTimestampMs === null ? null : new Date(latestTimestampMs).toISOString();

  const activeItems = includeActive ? buildActiveItems(args.activeRows) : [];
  const closedItems = includeClosed ? buildClosedItems(args.closedRows) : [];
  const items = [...activeItems, ...closedItems].sort(compareByCombinedPnlDesc);
  const includedItems = items.filter((item) => !item.excludeFromPeriodStats);
  const includedClosedItems = closedItems.filter((item) => !item.excludeFromPeriodStats);
  const excludedBotsCount = activeItems.filter((item) => item.excludeFromPeriodStats).length;
  const excludedRunsCount = closedItems.filter((item) => item.excludeFromPeriodStats).length;

  const coverageRatio = computeCoverageRatio({
    bounds,
    includeActive,
    includeClosed,
    latestTimestampMs,
    requestedDays: windowConfig.requestedDays,
    periodStartMs,
  });
  const observedDays = computeObservedDays({
    bounds,
    includeActive,
    includeClosed,
    latestTimestampMs,
    periodStartMs,
  });
  const combinedPnl = roundMetric(sumNullable(includedItems.map((item) => item.combinedPnl)));
  const netPnl = roundMetric(sumNullable(includedItems.map((item) => item.periodPnl)));
  const realizedPnl = roundMetric(sumNullable(includedItems.map((item) => item.realizedPnl)));
  const averagePnlPerDayStatus = deriveAveragePnlPerDayStatus(windowConfig.requestedDays, coverageRatio);
  const averagePnlPerDay =
    averagePnlPerDayStatus === "unavailable" || combinedPnl === null || observedDays === null || observedDays <= 0
      ? null
      : roundMetric(combinedPnl / observedDays);
  const realizedCoverageRatio = ratioOrNull(
    includedItems.filter((item) => item.realizedPnlStatus === "available").length,
    includedItems.length
  );
  const closedItemsCount = includedClosedItems.length;
  const lifetimeCoverageRatio =
    closedItemsCount > 0
      ? ratioOrNull(includedClosedItems.filter((item) => item.lifetimeStatus === "available").length, closedItemsCount)
      : null;
  const bestBot = includedItems.find((item) => item.combinedPnl !== null) || null;
  const worstBot = [...includedItems].reverse().find((item) => item.combinedPnl !== null) || null;
  const usesFinalPnlProxy = includedItems.some((item) => item.combinedPnl !== null && item.realizedPnl === null);
  const confidenceLevel = computeConfidenceLevel({
    coverageRatio,
    averagePnlPerDayStatus,
    usesFinalPnlProxy,
    itemsCount: includedItems.length,
  });

  return {
    window: {
      key: windowConfig.key,
      label: windowConfig.label,
      requestedDays: windowConfig.requestedDays,
      periodStart,
      periodEnd,
      observedDays,
      coverageRatio,
      coverageStatus: deriveCoverageStatus(coverageRatio),
    },
    composition: {
      key: args.composition,
      label: compositionLabel(args.composition),
    },
    summary: {
      netPnl,
      realizedPnl,
      combinedPnl,
      averagePnlPerDay,
      averagePnlPerDayStatus,
      confidenceLevel,
      botsInvolvedCount: includedItems.length,
      activeBotsCount: activeItems.filter((item) => !item.excludeFromPeriodStats).length,
      closedBotsCount: closedItemsCount,
      excludedBotsCount,
      excludedRunsCount,
      profitableBotsCount: includedItems.filter((item) => (item.combinedPnl ?? 0) > 0).length,
      losingBotsCount: includedItems.filter((item) => (item.combinedPnl ?? 0) < 0).length,
      bestBot: normalizeSpotlight(bestBot),
      worstBot: normalizeSpotlight(worstBot),
      realizedPnlCoverageRatio: realizedCoverageRatio,
      realizedPnlStatus: deriveCoverageStatus(realizedCoverageRatio),
      lifetimeCoverageRatio,
      lifetimeStatus: deriveCoverageStatus(lifetimeCoverageRatio),
      usesFinalPnlProxy,
      notes: buildNotes({
        windowKey: args.windowKey,
        includeClosed,
        coverageRatio,
        realizedCoverageRatio,
        lifetimeCoverageRatio,
        usesFinalPnlProxy,
        excludedBotsCount,
        excludedRunsCount,
        averagePnlPerDayStatus,
      }),
    },
    items,
  };
}

function buildActiveItems(rows: RawRow[]): SummaryItem[] {
  const grouped = new Map<number, RawRow[]>();
  for (const row of rows) {
    const botPk = toNumber(row.bot_pk);
    const list = grouped.get(botPk) || [];
    list.push(row);
    grouped.set(botPk, list);
  }

  return [...grouped.entries()].map(([botPk, snapshots]) => {
    const validTotalRows = snapshots
      .map((row) => ({
        row,
        timestampMs: parseTimestampMs(asString(row.snapshot_time)),
        totalPnl: toNullableNumber(row.total_pnl),
        realizedPnl: toNullableNumber(row.realized_pnl),
      }))
      .filter((entry) => entry.timestampMs !== null)
      .sort((left, right) => (left.timestampMs ?? 0) - (right.timestampMs ?? 0));

    const firstSnapshot = validTotalRows[0]?.row ?? snapshots[0] ?? null;
    const totalRows = validTotalRows.filter((entry) => entry.totalPnl !== null);
    const realizedRows = validTotalRows.filter((entry) => entry.realizedPnl !== null);
    const periodPnl =
      totalRows.length >= 2
        ? roundMetric((totalRows[totalRows.length - 1].totalPnl ?? 0) - (totalRows[0].totalPnl ?? 0))
        : null;
    const realizedPnl =
      realizedRows.length >= 2
        ? roundMetric((realizedRows[realizedRows.length - 1].realizedPnl ?? 0) - (realizedRows[0].realizedPnl ?? 0))
        : null;
    const observedDays =
      totalRows.length >= 2
        ? roundMetric(((totalRows[totalRows.length - 1].timestampMs ?? 0) - (totalRows[0].timestampMs ?? 0)) / DAY_MS)
        : null;
    const averagePnlPerDay =
      periodPnl !== null && observedDays !== null && observedDays > 0 ? roundMetric(periodPnl / observedDays) : null;

    return {
      key: `active:${botPk}`,
      sourceKind: "active",
      botId: asString(firstSnapshot?.bybit_bot_id) || `bot:${botPk}`,
      symbol: asString(firstSnapshot?.symbol),
      botType: asString(firstSnapshot?.bot_type),
      leverage: toNullableNumber(firstSnapshot?.leverage),
      currentStatus: "active",
      periodPnl,
      realizedPnl,
      combinedPnl: periodPnl,
      averagePnlPerDay,
      observedDays,
      closedAt: null,
      lifetimeDays: null,
      realizedPnlStatus: deriveFieldStatus(realizedPnl),
      lifetimeStatus: "unavailable",
      dataQualityStatus:
        totalRows.length >= 2 ? "available" : validTotalRows.length > 0 ? "incomplete" : "unavailable",
      excludeFromPeriodStats: toBoolean(firstSnapshot?.exclude_from_period_stats),
      excludeFromClosedStats: false,
      excludeReason: asString(firstSnapshot?.exclude_reason),
      excludeNote: asString(firstSnapshot?.exclude_note),
      profitabilityStatus: computeProfitabilityStatus(periodPnl),
    };
  });
}

function buildClosedItems(rows: RawRow[]): SummaryItem[] {
  return rows.map((row) => {
    const realizedPnl = toNullableNumber(row.realized_pnl);
    const periodPnl = toNullableNumber(row.total_pnl);
    const combinedPnl = periodPnl ?? realizedPnl;
    const lifetimeDays = toNullableNumber(row.lifetime_days);
    const averagePnlPerDay =
      combinedPnl !== null && lifetimeDays !== null && lifetimeDays > 0 ? roundMetric(combinedPnl / lifetimeDays) : null;

    return {
      key: `closed:${toNumber(row.closed_run_pk)}`,
      sourceKind: "closed",
      botId: asString(row.legacy_bot_id) || `closed:${toNumber(row.closed_run_pk)}`,
      symbol: asString(row.symbol),
      botType: asString(row.bot_type),
      leverage: toNullableNumber(row.leverage),
      currentStatus: "closed",
      periodPnl,
      realizedPnl,
      combinedPnl,
      averagePnlPerDay,
      observedDays: lifetimeDays,
      closedAt: asString(row.closed_at) || asString(row.last_observed_at),
      lifetimeDays,
      realizedPnlStatus: deriveFieldStatus(realizedPnl),
      lifetimeStatus: deriveFieldStatus(lifetimeDays),
      dataQualityStatus:
        combinedPnl === null ? "unavailable" : realizedPnl === null || lifetimeDays === null ? "incomplete" : "available",
      excludeFromPeriodStats: toBoolean(row.exclude_from_period_stats),
      excludeFromClosedStats: toBoolean(row.exclude_from_closed_stats),
      excludeReason: asString(row.exclude_reason),
      excludeNote: asString(row.exclude_note),
      profitabilityStatus: computeProfitabilityStatus(combinedPnl),
    };
  });
}

function normalizeSpotlight(item: SummaryItem | null) {
  if (!item) {
    return null;
  }

  return {
    botId: item.botId,
    symbol: item.symbol,
    leverage: item.leverage,
    sourceKind: item.sourceKind,
    combinedPnl: item.combinedPnl,
    realizedPnl: item.realizedPnl,
    profitabilityStatus: item.profitabilityStatus,
  };
}

function buildNotes(args: {
  windowKey: PeriodWindowKey;
  includeClosed: boolean;
  coverageRatio: number | null;
  realizedCoverageRatio: number | null;
  lifetimeCoverageRatio: number | null;
  usesFinalPnlProxy: boolean;
  excludedBotsCount: number;
  excludedRunsCount: number;
  averagePnlPerDayStatus: CoverageStatus;
}) {
  const notes: string[] = [];

  if (args.windowKey === "all") {
    notes.push("all_time_tracked_history");
  }
  if (args.coverageRatio !== null && args.coverageRatio < 0.98) {
    notes.push("partial_period");
  }
  if (args.realizedCoverageRatio === null || args.realizedCoverageRatio < 0.999) {
    notes.push("realized_incomplete");
  }
  if (args.includeClosed && (args.lifetimeCoverageRatio === null || args.lifetimeCoverageRatio < 0.999)) {
    notes.push("lifetime_incomplete");
  }
  if (args.usesFinalPnlProxy) {
    notes.push("uses_final_pnl_proxy");
  }
  if (args.averagePnlPerDayStatus === "incomplete") {
    notes.push("average_pnl_day_preliminary");
  }
  if (args.averagePnlPerDayStatus === "unavailable") {
    notes.push("average_pnl_day_unavailable");
  }
  if (args.excludedBotsCount > 0 || args.excludedRunsCount > 0) {
    notes.push("excluded_records_impact");
  }

  return notes;
}

function compositionLabel(value: SummaryComposition) {
  if (value === "active") {
    return "Только активные боты";
  }
  if (value === "closed") {
    return "Только закрытые боты";
  }
  return "Активные + закрытые";
}

function computeCoverageRatio(args: {
  bounds: SourceBounds;
  includeActive: boolean;
  includeClosed: boolean;
  latestTimestampMs: number | null;
  requestedDays: number | null;
  periodStartMs: number | null;
}) {
  if (args.requestedDays === null) {
    return 1;
  }

  const observedDays = computeObservedDays(args);
  if (observedDays === null) {
    return 0;
  }

  return roundMetric(Math.min(1, observedDays / args.requestedDays));
}

function computeObservedDays(args: {
  bounds: SourceBounds;
  includeActive: boolean;
  includeClosed: boolean;
  latestTimestampMs: number | null;
  periodStartMs: number | null;
}) {
  if (args.latestTimestampMs === null) {
    return null;
  }

  const effectiveStarts = [
    args.includeActive ? effectiveStartMs(args.bounds.activeMinSnapshotTime, args.periodStartMs) : null,
    args.includeClosed ? effectiveStartMs(args.bounds.closedMinTime, args.periodStartMs) : null,
  ].filter((value): value is number => value !== null);

  if (!effectiveStarts.length) {
    return null;
  }

  const earliestMs = Math.min(...effectiveStarts);
  return roundMetric(Math.max(0, (args.latestTimestampMs - earliestMs) / DAY_MS));
}

function effectiveStartMs(rawValue: string | null, periodStartMs: number | null) {
  const parsed = parseTimestampMs(rawValue);
  if (parsed === null) {
    return null;
  }
  if (periodStartMs === null) {
    return parsed;
  }
  return Math.max(parsed, periodStartMs);
}

function normalizeBounds(row: RawRow | null): SourceBounds {
  return {
    activeMinSnapshotTime: asString(row?.active_min_snapshot_time),
    activeMaxSnapshotTime: asString(row?.active_max_snapshot_time),
    closedMinTime: asString(row?.closed_min_time),
    closedMaxTime: asString(row?.closed_max_time),
  };
}

function getLatestTimestampMs(bounds: SourceBounds, includeActive: boolean, includeClosed: boolean) {
  const values = [
    includeActive ? bounds.activeMaxSnapshotTime : null,
    includeClosed ? bounds.closedMaxTime : null,
  ]
    .map((value) => parseTimestampMs(value))
    .filter((value): value is number => value !== null);

  return values.length ? Math.max(...values) : null;
}

function parseTimestampMs(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareByCombinedPnlDesc(left: SummaryItem, right: SummaryItem) {
  return (right.combinedPnl ?? -Infinity) - (left.combinedPnl ?? -Infinity);
}

function computeProfitabilityStatus(value: number | null) {
  if (value === null) {
    return "unknown";
  }
  if (value > 0) {
    return "profit";
  }
  if (value < 0) {
    return "loss";
  }
  return "flat";
}

function deriveCoverageStatus(value: number | null): CoverageStatus {
  if (value === null || value <= 0) {
    return "unavailable";
  }
  if (value >= 0.999) {
    return "available";
  }
  return "incomplete";
}

function deriveFieldStatus(value: number | null): CoverageStatus {
  return value === null ? "unavailable" : "available";
}

function deriveAveragePnlPerDayStatus(requestedDays: number | null, coverageRatio: number | null): CoverageStatus {
  if (coverageRatio === null || coverageRatio <= 0) {
    return "unavailable";
  }

  if (requestedDays === null) {
    return deriveCoverageStatus(coverageRatio);
  }

  if (requestedDays <= 1) {
    if (coverageRatio >= 0.999) {
      return "available";
    }
    if (coverageRatio >= 0.25) {
      return "incomplete";
    }
    return "unavailable";
  }

  if (coverageRatio >= 0.98) {
    return "available";
  }
  if (coverageRatio >= 0.75) {
    return "incomplete";
  }
  return "unavailable";
}

function computeConfidenceLevel(args: {
  coverageRatio: number | null;
  averagePnlPerDayStatus: CoverageStatus;
  usesFinalPnlProxy: boolean;
  itemsCount: number;
}): "low" | "medium" | "high" {
  if (args.itemsCount <= 0 || args.averagePnlPerDayStatus === "unavailable") {
    return "low";
  }

  if ((args.coverageRatio ?? 0) >= 0.98 && !args.usesFinalPnlProxy && args.averagePnlPerDayStatus === "available") {
    return "high";
  }

  if ((args.coverageRatio ?? 0) >= 0.5) {
    return "medium";
  }

  return "low";
}

function sumNullable(values: Array<number | null>) {
  const filtered = values.filter((value): value is number => value !== null);
  if (!filtered.length) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0);
}

function ratioOrNull(numerator: number, denominator: number) {
  return denominator > 0 ? roundMetric(numerator / denominator) : null;
}

function roundMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 10000) / 10000;
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
