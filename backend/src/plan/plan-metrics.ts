import { metrics } from "../shared/legacy-bridge";
import { computeGridProfitDeltaSinceWindowStart, parseTimestampMs, startOfLocalDayMs } from "../shared/current-day-profit";

type ContributionStatus = "strong" | "medium" | "weak" | "drag";
type PlanCategory = "active_in_plan" | "active_out_of_plan" | "closed";
type RawRow = Record<string, unknown>;
type SnapshotPoint = {
  botPk: number;
  gridProfit: number | null;
  equity: number | null;
  timestampMs: number;
};
type WindowBotStats = {
  actualDailyIncome: number | null;
  observedDays: number | null;
  coverageRatio: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOWS = [
  { key: "1d", label: "1 день", requestedDays: 1 },
  { key: "7d", label: "7 дней", requestedDays: 7 },
  { key: "30d", label: "30 дней", requestedDays: 30 },
  { key: "90d", label: "90 дней", requestedDays: 90 },
] as const;

export function buildCurrentPlanDto(planRow: RawRow | null, participantRows: RawRow[], snapshotRows: RawRow[]) {
  const targetDailyIncome = toNullableNumber(planRow?.target_daily_pnl_usd) ?? 30;
  const baseParticipants = participantRows.map((row) => buildParticipant(row, targetDailyIncome));
  const activeIncludedParticipants = baseParticipants.filter(
    (participant) => participant.isActive && participant.isIncluded && !participant.excludeFromPlan
  );
  const activeIncludedBotPks = new Set(activeIncludedParticipants.map((participant) => participant.botPk));
  const participantStartedAtMs = new Map(
    baseParticipants.map((participant) => [participant.botPk, parseTimestampMs(participant.workStartedAt)])
  );
  const filteredSnapshots = normalizeSnapshots(snapshotRows).filter((snapshot) => activeIncludedBotPks.has(snapshot.botPk));
  const latestTimestampMs =
    filteredSnapshots.length > 0
      ? Math.max(...filteredSnapshots.map((snapshot) => snapshot.timestampMs))
      : Date.now();
  const oneDayWindowStats = buildWindowStats(filteredSnapshots, 1, latestTimestampMs, participantStartedAtMs);
  const performanceWindows = WINDOWS.map((window) =>
    buildPerformanceWindow(
      window.key,
      window.label,
      window.requestedDays,
      filteredSnapshots,
      latestTimestampMs,
      targetDailyIncome,
      participantStartedAtMs
    )
  );

  const currentPlanCapital = roundMetric(sumBy(activeIncludedParticipants, (participant) => participant.equity));
  const estimatedDailyIncome = roundMetric(sumBy(activeIncludedParticipants, (participant) => participant.estimatedIncomePerDay));
  const actualDailyIncome = performanceWindows[0]?.avgDailyPnlUsd ?? null;
  const currentTotalPnlUsd = roundMetric(sumBy(activeIncludedParticipants, (participant) => participant.totalPnl));
  const percentOfTarget =
    targetDailyIncome > 0 && estimatedDailyIncome !== null
      ? roundMetric(estimatedDailyIncome / targetDailyIncome)
      : null;
  const signedGapToTarget =
    estimatedDailyIncome === null ? null : roundMetric(estimatedDailyIncome - targetDailyIncome);
  const deficitToTarget =
    estimatedDailyIncome === null ? roundMetric(targetDailyIncome) : roundMetric(Math.max(0, targetDailyIncome - estimatedDailyIncome));
  const estimatedDailyYieldRatio =
    currentPlanCapital !== null && currentPlanCapital > 0 && estimatedDailyIncome !== null
      ? roundMetric(estimatedDailyIncome / currentPlanCapital)
      : null;
  const requiredCapital =
    estimatedDailyYieldRatio !== null && estimatedDailyYieldRatio > 0
      ? roundMetric(targetDailyIncome / estimatedDailyYieldRatio)
      : null;
  const missingCapital =
    requiredCapital === null || currentPlanCapital === null
      ? null
      : roundMetric(Math.max(0, requiredCapital - currentPlanCapital));
  const participatingBotsCount = activeIncludedParticipants.length;
  const botsWithEstimateDataCount = activeIncludedParticipants.filter(
    (participant) => participant.estimatedIncomePerDay !== null
  ).length;
  const botsWithRuntimeEstimateCount = activeIncludedParticipants.filter(
    (participant) => participant.estimateSource === "runtime"
  ).length;
  const botsWithAprFallbackCount = activeIncludedParticipants.filter(
    (participant) => participant.estimateSource === "apr"
  ).length;
  const botsWithActualDataCount = activeIncludedParticipants.filter(
    (participant) => (oneDayWindowStats.perBot.get(participant.botPk)?.actualDailyIncome ?? null) !== null
  ).length;
  const estimatedBotsCoverage = ratioOrZero(botsWithEstimateDataCount, participatingBotsCount);
  const actualBotsCoverage = ratioOrZero(botsWithActualDataCount, participatingBotsCount);
  const observationCoverage = performanceWindows[0]?.coverageRatio ?? 0;
  const confidenceReasons = buildConfidenceReasons({
    participatingBotsCount,
    observationCoverage,
    estimatedBotsCoverage,
    actualBotsCoverage,
    aprFallbackCount: botsWithAprFallbackCount,
  });

  const participants = baseParticipants.map((participant) => {
    const windowStats = oneDayWindowStats.perBot.get(participant.botPk);
    const actualIncomePerDay = participant.isActive ? windowStats?.actualDailyIncome ?? null : null;
    const actualObservationDays = participant.isActive ? windowStats?.observedDays ?? null : null;
    const actualCoverageRatio = participant.isActive ? windowStats?.coverageRatio ?? 0 : 0;
    const contributionBasis =
      actualIncomePerDay !== null && actualCoverageRatio >= 0.25
        ? "actual"
        : participant.estimatedIncomePerDay !== null
          ? participant.estimateSource
          : null;
    const contributionValue =
      contributionBasis === "actual"
        ? actualIncomePerDay
        : contributionBasis === "runtime" || contributionBasis === "apr"
          ? participant.estimatedIncomePerDay
          : null;
    const contributionToTargetRatio =
      targetDailyIncome > 0 && contributionValue !== null ? roundMetric(contributionValue / targetDailyIncome) : null;

    return {
      ...participant,
      actualIncomePerDay,
      actualObservationDays,
      actualObservationCoverage: roundMetric(actualCoverageRatio),
      contributionBasis,
      contributionToTargetRatio,
      contributionStatus: computeContributionStatus(contributionValue, targetDailyIncome),
    };
  });

  const activeBotsTotal = participants.filter((participant) => participant.isActive).length;
  const activeBotsOutsidePlanCount = participants.filter(
    (participant) => participant.isActive && !participant.isIncluded && !participant.excludeFromPlan
  ).length;
  const closedBotsCount = participants.filter((participant) => !participant.isActive).length;
  const closedBotsInPlanCount = participants.filter((participant) => !participant.isActive && participant.isIncluded).length;
  const excludedBotsCount = participants.filter((participant) => participant.isActive && participant.excludeFromPlan).length;

  return {
    planPk: toNumber(planRow?.plan_pk),
    title: asString(planRow?.title) || "План дохода",
    targetDailyPnlUsd: targetDailyIncome,
    status: normalizePlanStatus(asString(planRow?.status)),
    notes: asString(planRow?.notes),
    createdAt: asString(planRow?.created_at),
    updatedAt: asString(planRow?.updated_at),
    summary: {
      includedBots: participants.filter((participant) => participant.isIncluded).length,
      totalBots: participants.length,
      activeIncludedBots: participatingBotsCount,
      currentEstimatedDailyPnlUsd: estimatedDailyIncome ?? 0,
      currentTotalPnlUsd: currentTotalPnlUsd ?? 0,
      totalEquityUsd: currentPlanCapital ?? 0,
      gapToTargetUsd: signedGapToTarget,
      progressRatio: percentOfTarget,
      estimatedDailyYieldRatio,
      requiredCapitalUsd: requiredCapital,
      additionalCapitalNeededUsd: missingCapital,
      performanceWindows,
      targetDailyIncome,
      estimatedDailyIncome,
      actualDailyIncome,
      deficitToTarget,
      percentOfTarget,
      participatingBotsCount,
      currentPlanCapital,
      requiredCapital,
      missingCapital,
      observationCoverage: roundMetric(observationCoverage),
      confidenceLevel: computeConfidenceLevel({
        participatingBotsCount,
        observationCoverage,
        estimatedBotsCoverage,
        actualBotsCoverage,
      }),
      confidenceReasons,
      estimatedBotsCoverage: roundMetric(estimatedBotsCoverage),
      actualBotsCoverage: roundMetric(actualBotsCoverage),
      botsWithEstimateDataCount,
      botsWithRuntimeEstimateCount,
      botsWithAprFallbackCount,
      botsWithActualDataCount,
      allActiveBotsCount: activeBotsTotal,
      activeBotsOutsidePlanCount,
      closedBotsCount,
      closedBotsInPlanCount,
      excludedBotsCount,
    },
    participants,
  };
}

function buildParticipant(row: RawRow, targetDailyIncome: number) {
  const timing = extractBybitTiming(row);
  const analytics = metrics.withBotAnalytics({
    total_apr: toNullableNumber(row.total_apr),
    grid_apr: toNullableNumber(row.grid_apr),
    total_pnl: toNullableNumber(row.total_pnl),
    equity: toNullableNumber(row.equity),
    investment: toNullableNumber(row.analytics_investment),
    activity_count: toNullableNumber(row.activity_count),
    local_peak_total_pnl: toNullableNumber(row.local_peak_total_pnl),
    runtime_started_at: timing.workStartedAt ?? asString(row.confirmed_at) ?? asString(row.first_seen_at),
    runtime_ended_at: toBoolean(row.is_active) ? null : asString(row.last_snapshot_at),
  }) as Record<string, unknown>;

  const isActive = toBoolean(row.is_active);
  const isIncluded = toBoolean(row.is_included);
  const currentGridProfit = toNullableNumber(row.grid_profit);
  const aprIncomePerDay = toNullableNumber(analytics.grid_profit_per_day);
  const runtimeIncomePerDay =
    currentGridProfit !== null && timing.workRuntimeSec !== null && timing.workRuntimeSec > 0
      ? roundMetric(currentGridProfit / (timing.workRuntimeSec / 86400))
      : null;
  const estimatedIncomePerDay = runtimeIncomePerDay ?? aprIncomePerDay;
  const estimateSource = runtimeIncomePerDay !== null ? "runtime" : aprIncomePerDay !== null ? "apr" : null;
  const contributionToTargetRatio =
    targetDailyIncome > 0 && estimatedIncomePerDay !== null
      ? roundMetric(estimatedIncomePerDay / targetDailyIncome)
      : null;

  return {
    botPk: toNumber(row.bot_pk),
    botId: asString(row.bybit_bot_id) || `bot:${toNumber(row.bot_pk)}`,
    symbol: asString(row.symbol),
    botType: asString(row.bot_type),
    status: asString(row.status),
    equity: toNullableNumber(row.equity),
    totalPnl: toNullableNumber(row.total_pnl),
    totalApr: toNullableNumber(row.total_apr),
    gridApr: toNullableNumber(row.grid_apr),
    leverage: toNullableNumber(row.leverage),
    activityCount: toNullableNumber(row.activity_count),
    currentGridProfit,
    gridProfitPerDay: aprIncomePerDay,
    aprIncomePerDay,
    estimatedIncomePerDay,
    runtimeIncomePerDay,
    workRuntimeSec: timing.workRuntimeSec,
    workStartedAt: timing.workStartedAt,
    statusHint: normalizeStatusHint(asString(analytics.status_hint)),
    isIncluded,
    isActive,
    weight: toNullableNumber(row.weight) ?? 1,
    membershipUpdatedAt: asString(row.membership_updated_at),
    lastSeenAt: asString(row.last_seen_at),
    excludeFromPlan: toBoolean(row.exclude_from_plan),
    excludeFromPeriodStats: toBoolean(row.exclude_from_period_stats),
    excludeReason: asString(row.exclude_reason),
    excludeNote: asString(row.exclude_note),
    planCategory: classifyPlanCategory(isActive, isIncluded),
    estimateSource,
    contributionBasis: estimatedIncomePerDay === null ? null : estimateSource,
    contributionToTargetRatio,
    contributionStatus: computeContributionStatus(estimatedIncomePerDay, targetDailyIncome),
    actualIncomePerDay: null,
    actualObservationDays: null,
    actualObservationCoverage: 0,
  };
}

function buildPerformanceWindow(
  key: string,
  label: string,
  requestedDays: number,
  snapshots: SnapshotPoint[],
  latestTimestampMs: number,
  targetDailyIncome: number,
  startedAtByBot: Map<number, number | null>
) {
  const windowStats = buildWindowStats(snapshots, requestedDays, latestTimestampMs, startedAtByBot);
  const avgCapitalUsd = windowStats.avgPortfolioEquityUsd;
  const avgDailyPnlUsd =
    requestedDays === 1
      ? windowStats.botsWithActualDataCount > 0
        ? roundMetric(windowStats.pnlDeltaUsd)
        : null
      : windowStats.observedDays > 0
        ? roundMetric(windowStats.pnlDeltaUsd / windowStats.observedDays)
        : null;
  const dailyYieldRatio =
    avgCapitalUsd !== null && avgCapitalUsd > 0 && avgDailyPnlUsd !== null
      ? roundMetric(avgDailyPnlUsd / avgCapitalUsd)
      : null;
  const requiredCapitalUsd =
    dailyYieldRatio !== null && dailyYieldRatio > 0
      ? roundMetric(targetDailyIncome / dailyYieldRatio)
      : null;
  const missingCapitalUsd =
    requiredCapitalUsd === null || avgCapitalUsd === null
      ? null
      : roundMetric(Math.max(0, requiredCapitalUsd - avgCapitalUsd));
  const botCoverageRatio = ratioOrZero(windowStats.botsWithActualDataCount, windowStats.eligibleBotsCount);

  return {
    key,
    label,
    requestedDays,
    observedDays: roundMetric(windowStats.observedDays),
    coverageRatio: roundMetric(requestedDays > 0 ? Math.min(1, windowStats.observedDays / requestedDays) : 0),
    avgDailyPnlUsd,
    avgCapitalUsd,
    dailyYieldRatio,
    requiredCapitalUsd,
    missingCapitalUsd,
    eligibleBotsCount: windowStats.eligibleBotsCount,
    botsWithActualDataCount: windowStats.botsWithActualDataCount,
    botCoverageRatio: roundMetric(botCoverageRatio),
    confidenceLevel: computeWindowConfidenceLevel({
      coverageRatio: requestedDays > 0 ? Math.min(1, windowStats.observedDays / requestedDays) : 0,
      botCoverageRatio,
      hasActualData: avgDailyPnlUsd !== null,
    }),
    confidenceReasons: buildWindowConfidenceReasons({
      observedDays: windowStats.observedDays,
      requestedDays,
      eligibleBotsCount: windowStats.eligibleBotsCount,
      botsWithActualDataCount: windowStats.botsWithActualDataCount,
    }),
  };
}

function buildWindowStats(
  snapshots: SnapshotPoint[],
  requestedDays: number,
  latestTimestampMs: number,
  startedAtByBot: Map<number, number | null>
) {
  const thresholdTimestampMs =
    requestedDays === 1 ? startOfLocalDayMs(latestTimestampMs) : latestTimestampMs - requestedDays * DAY_MS;
  const rowsInWindow = snapshots.filter((snapshot) => snapshot.timestampMs >= thresholdTimestampMs);
  const grouped = groupByBot(snapshots.filter((snapshot) => snapshot.timestampMs <= latestTimestampMs));
  const perBot = new Map<number, WindowBotStats>();
  let pnlDeltaUsd = 0;
  let botsWithActualDataCount = 0;

  grouped.forEach((rows, botPk) => {
    const sortedRows = [...rows].sort((left, right) => left.timestampMs - right.timestampMs);
    const windowRows = sortedRows.filter((row) => row.timestampMs >= thresholdTimestampMs);
    const timestamps = windowRows.map((row) => row.timestampMs);
    const observedDays =
      timestamps.length >= 2 ? Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / DAY_MS) : 0;
    const pnlRows = windowRows.filter((row) => row.gridProfit !== null);
    const allPnlRows = sortedRows.filter((row) => row.gridProfit !== null);
    const baselineRow = [...allPnlRows].reverse().find((row) => row.timestampMs <= thresholdTimestampMs) ?? null;
    const latestRow = [...allPnlRows].reverse().find((row) => row.timestampMs <= latestTimestampMs) ?? null;
    const actualDailyIncome =
      requestedDays === 1
        ? computeGridProfitDeltaSinceWindowStart({
            baselineGridProfit: baselineRow?.gridProfit ?? null,
            firstWindowGridProfit: pnlRows[0]?.gridProfit ?? null,
            latestGridProfit: latestRow?.gridProfit ?? null,
            startedAtMs: startedAtByBot.get(botPk) ?? null,
            windowStartMs: thresholdTimestampMs,
          })
        : pnlRows.length >= 2 && observedDays > 0
          ? roundMetric((Number(pnlRows[pnlRows.length - 1].gridProfit) - Number(pnlRows[0].gridProfit)) / observedDays)
          : null;

    if (actualDailyIncome !== null) {
      pnlDeltaUsd +=
        requestedDays === 1
          ? actualDailyIncome
          : Number(pnlRows[pnlRows.length - 1].gridProfit) - Number(pnlRows[0].gridProfit);
      botsWithActualDataCount += 1;
    }

    perBot.set(botPk, {
      actualDailyIncome,
      observedDays: roundMetric(observedDays),
      coverageRatio: requestedDays > 0 ? Math.min(1, observedDays / requestedDays) : 0,
    });
  });

  const timestamps = rowsInWindow.map((row) => row.timestampMs);
  const observedDays =
    timestamps.length >= 2 ? Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / DAY_MS) : 0;

  return {
    perBot,
    observedDays,
    pnlDeltaUsd,
    avgPortfolioEquityUsd: computeAveragePortfolioEquity(rowsInWindow),
    eligibleBotsCount: grouped.size,
    botsWithActualDataCount,
  };
}

function computeAveragePortfolioEquity(rows: SnapshotPoint[]) {
  const totalsByTimestamp = new Map<number, number>();

  rows.forEach((row) => {
    if (row.equity === null) {
      return;
    }

    totalsByTimestamp.set(row.timestampMs, (totalsByTimestamp.get(row.timestampMs) ?? 0) + row.equity);
  });

  if (totalsByTimestamp.size === 0) {
    return null;
  }

  return roundMetric(sumBy([...totalsByTimestamp.values()], (value) => value) / totalsByTimestamp.size);
}

function normalizeSnapshots(rows: RawRow[]) {
  return rows
    .map((row) => ({
      botPk: toNumber(row.bot_pk),
      gridProfit: toNullableNumber(row.grid_profit),
      equity: toNullableNumber(row.equity),
      timestampMs: Date.parse(asString(row.snapshot_time) || ""),
    }))
    .filter((row) => Number.isFinite(row.timestampMs));
}

function groupByBot(rows: SnapshotPoint[]) {
  const grouped = new Map<number, SnapshotPoint[]>();

  rows.forEach((row) => {
    if (!grouped.has(row.botPk)) {
      grouped.set(row.botPk, []);
    }

    grouped.get(row.botPk)?.push(row);
  });

  return grouped;
}

function extractBybitTiming(row: RawRow) {
  const createTime = asString(row.create_time);
  const operationTimeMs = toNullableNumber(row.operation_time_ms);

  if (createTime || operationTimeMs !== null) {
    return {
      workStartedAt: createTime,
      workRuntimeSec: operationTimeMs === null ? null : Math.max(0, Math.round(operationTimeMs / 1000)),
    };
  }

  const rawPayloadJson = asString(row.raw_payload_json);
  if (!rawPayloadJson) {
    return {
      workStartedAt: null,
      workRuntimeSec: null,
    };
  }

  try {
    const payload = JSON.parse(rawPayloadJson) as Record<string, unknown>;
    const rawCreateTime = toNullableNumber(payload.create_time);
    const rawOperationTimeMs = toNullableNumber(payload.operation_time);

    return {
      workStartedAt: rawCreateTime === null ? null : new Date(rawCreateTime).toISOString(),
      workRuntimeSec: rawOperationTimeMs === null ? null : Math.max(0, Math.round(rawOperationTimeMs / 1000)),
    };
  } catch {
    return {
      workStartedAt: null,
      workRuntimeSec: null,
    };
  }
}

function buildConfidenceReasons({
  participatingBotsCount,
  observationCoverage,
  estimatedBotsCoverage,
  actualBotsCoverage,
  aprFallbackCount,
}: {
  participatingBotsCount: number;
  observationCoverage: number;
  estimatedBotsCoverage: number;
  actualBotsCoverage: number;
  aprFallbackCount: number;
}) {
  const reasons: string[] = [];

  if (participatingBotsCount === 0) {
    reasons.push("no_active_bots_in_plan");
    return reasons;
  }

  if (observationCoverage <= 0) {
    reasons.push("no_actual_observation");
  } else if (observationCoverage < 1) {
    reasons.push("partial_day");
  }

  if (estimatedBotsCoverage < 1) {
    reasons.push("missing_estimate_data");
  }

  if (actualBotsCoverage < 1) {
    reasons.push("missing_actual_data");
  }

  if (aprFallbackCount > 0) {
    reasons.push("apr_fallback_used");
  }

  return reasons;
}

function buildWindowConfidenceReasons({
  observedDays,
  requestedDays,
  eligibleBotsCount,
  botsWithActualDataCount,
}: {
  observedDays: number;
  requestedDays: number;
  eligibleBotsCount: number;
  botsWithActualDataCount: number;
}) {
  const reasons: string[] = [];

  if (eligibleBotsCount === 0) {
    reasons.push("no_active_bots_in_plan");
    return reasons;
  }

  if (observedDays <= 0) {
    reasons.push("no_actual_observation");
  } else if (observedDays < requestedDays) {
    reasons.push("partial_window");
  }

  if (botsWithActualDataCount < eligibleBotsCount) {
    reasons.push("missing_actual_data");
  }

  return reasons;
}

function computeConfidenceLevel({
  participatingBotsCount,
  observationCoverage,
  estimatedBotsCoverage,
  actualBotsCoverage,
}: {
  participatingBotsCount: number;
  observationCoverage: number;
  estimatedBotsCoverage: number;
  actualBotsCoverage: number;
}) {
  if (participatingBotsCount === 0) {
    return "low";
  }

  if (observationCoverage >= 0.98 && estimatedBotsCoverage >= 0.8 && actualBotsCoverage >= 0.8) {
    return "high";
  }

  if (observationCoverage >= 0.25 && estimatedBotsCoverage >= 0.5) {
    return "medium";
  }

  return "low";
}

function computeWindowConfidenceLevel({
  coverageRatio,
  botCoverageRatio,
  hasActualData,
}: {
  coverageRatio: number;
  botCoverageRatio: number;
  hasActualData: boolean;
}) {
  if (!hasActualData || coverageRatio <= 0) {
    return "low";
  }

  if (coverageRatio >= 0.98 && botCoverageRatio >= 0.8) {
    return "high";
  }

  if (coverageRatio >= 0.25 && botCoverageRatio >= 0.5) {
    return "medium";
  }

  return "low";
}

function computeContributionStatus(value: number | null, targetDailyIncome: number): ContributionStatus {
  if (value === null || value <= 0 || targetDailyIncome <= 0) {
    return "drag";
  }

  const ratio = value / targetDailyIncome;
  if (ratio >= 0.25) {
    return "strong";
  }
  if (ratio >= 0.1) {
    return "medium";
  }
  return "weak";
}

function classifyPlanCategory(isActive: boolean, isIncluded: boolean): PlanCategory {
  if (!isActive) {
    return "closed";
  }

  return isIncluded ? "active_in_plan" : "active_out_of_plan";
}

function normalizeStatusHint(value: string | null) {
  if (
    value === "high_drawdown" ||
    value === "weak_activity" ||
    value === "grid_works_position_hurts" ||
    value === "overall_green"
  ) {
    return value;
  }

  return "unknown";
}

function normalizePlanStatus(value: string | null) {
  if (value === "paused" || value === "archived") {
    return value;
  }

  return "active";
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown) {
  return Number(value) === 1 || value === true;
}

function sumBy<T>(items: T[], getValue: (item: T) => number | null) {
  return items.reduce((sum, item) => sum + (getValue(item) ?? 0), 0);
}

function ratioOrZero(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return part / total;
}

function roundMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}
