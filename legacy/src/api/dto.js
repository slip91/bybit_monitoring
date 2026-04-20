const { withBotAnalytics } = require("../metrics/fgrid");

/**
 * @typedef {Object} BotListItemDto
 * @property {string} id
 * @property {number} botPk
 * @property {string|null} bybitBotId
 * @property {string|null} symbol
 * @property {string|null} botType
 * @property {string|null} status
 * @property {number|null} equity
 * @property {number|null} totalPnl
 * @property {number|null} totalApr
 * @property {number|null} gridApr
 * @property {number|null} gridProfit
 * @property {number|null} leverage
 * @property {number|null} activityCount
 * @property {number|null} pnlGap
 * @property {number|null} pnlToEquityRatio
 * @property {number|null} activityScore
 * @property {number|null} drawdownFromLocalPeak
 * @property {string|null} runtimeStartedAt
 * @property {number|null} runtimeSec
 * @property {number|null} runtimeDays
 * @property {string|null} workStartedAt
 * @property {number|null} workRuntimeSec
 * @property {number|null} gridProfitPerDay
 * @property {number|null} factPnlPerDay
 * @property {string} statusHint
 * @property {string} identityStatus
 * @property {number|null} inferenceConfidence
 * @property {number} snapshotCount
 * @property {number} openAlertCount
 * @property {string|null} firstSeenAt
 * @property {string|null} lastSeenAt
 * @property {string|null} lastSnapshotAt
 */

/**
 * @typedef {Object} BotSnapshotDto
 * @property {number} snapshotId
 * @property {string} snapshotTime
 * @property {string} source
 * @property {string|null} symbol
 * @property {string|null} botType
 * @property {string|null} status
 * @property {number|null} equity
 * @property {number|null} totalPnl
 * @property {number|null} totalApr
 * @property {number|null} gridApr
 * @property {number|null} leverage
 * @property {number|null} activityCount
 * @property {number|null} pnlGap
 * @property {number|null} pnlToEquityRatio
 * @property {number|null} activityScore
 * @property {number|null} drawdownFromLocalPeak
 * @property {string|null} runtimeStartedAt
 * @property {number|null} runtimeSec
 * @property {number|null} runtimeDays
 * @property {string|null} workStartedAt
 * @property {number|null} workRuntimeSec
 * @property {number|null} leverage
 * @property {number|null} gridProfitPerDay
 * @property {number|null} factPnlPerDay
 * @property {string} statusHint
 * @property {number|null} investment
 * @property {number|null} realizedPnl
 * @property {number|null} unrealizedPnl
 * @property {number|null} fundingFees
 * @property {number|null} liquidationPrice
 * @property {number|null} totalOrderBalance
 * @property {number|null} availableBalance
 * @property {number|null} positionBalance
 */

/**
 * @typedef {Object} BotDetailsDto
 * @property {string} id
 * @property {number} botPk
 * @property {string|null} bybitBotId
 * @property {string|null} guessedKey
 * @property {string} identityStatus
 * @property {number|null} inferenceConfidence
 * @property {string|null} inferenceReason
 * @property {string|null} symbol
 * @property {string|null} botType
 * @property {string|null} status
 * @property {string|null} route
 * @property {string|null} source
 * @property {boolean} isActive
 * @property {string|null} firstSeenAt
 * @property {string|null} lastSeenAt
 * @property {string|null} confirmedAt
 * @property {string|null} lastSnapshotAt
 * @property {number} snapshotCount
 * @property {number} openAlertCount
 * @property {string|null} runtimeStartedAt
 * @property {number|null} runtimeSec
 * @property {number|null} runtimeDays
 * @property {string|null} workStartedAt
 * @property {number|null} workRuntimeSec
 * @property {number|null} gridProfitPerDay
 * @property {number|null} factPnlPerDay
 * @property {BotSnapshotDto|null} latestSnapshot
 */

/**
 * @typedef {Object} DashboardSummaryDto
 * @property {Object} totals
 * @property {Object[]} statusBreakdown
 * @property {Object[]} botTypeBreakdown
 */

/**
 * @typedef {Object} AlertDto
 * @property {number} alertPk
 * @property {string} alertType
 * @property {string} severity
 * @property {string} status
 * @property {string} title
 * @property {string|null} message
 * @property {string|null} metricName
 * @property {number|null} metricValue
 * @property {number|null} thresholdValue
 * @property {string|null} comparisonOperator
 * @property {string|null} source
 * @property {string} alertTime
 * @property {string|null} acknowledgedAt
 * @property {string|null} resolvedAt
 * @property {Object|null} bot
 */

/**
 * @typedef {Object} HealthDto
 * @property {string} status
 * @property {string} time
 * @property {number} uptimeSec
 * @property {Object} database
 */

/**
 * @typedef {Object} MetricsDto
 * @property {string} time
 * @property {number} uptimeSec
 * @property {Object} database
 * @property {Object} counters
 */

/**
 * @typedef {Object} ServiceStatusDto
 * @property {string} serviceName
 * @property {string} status
 * @property {string|null} lastStartedAt
 * @property {string|null} lastFinishedAt
 * @property {string|null} lastSuccessAt
 * @property {string|null} lastErrorAt
 * @property {string|null} lastErrorMessage
 * @property {string|null} lastSnapshotTime
 * @property {number|null} lastActiveBots
 * @property {number|null} lastSnapshotsInserted
 * @property {string|null} updatedAt
 */

/**
 * @typedef {Object} TelegramAlertSettingsDto
 * @property {boolean} enabled
 * @property {string|null} chatId
 * @property {string} minSeverity
 * @property {boolean} sendResolved
 * @property {boolean} tradeActivityNotificationsEnabled
 * @property {string[]} tradeActivityMutedBotIds
 * @property {boolean} hasBotToken
 * @property {string|null} botTokenMasked
 * @property {string|null} updatedAt
 */

/**
 * @typedef {Object} BotAlertRuleDto
 * @property {number} botPk
 * @property {string} botId
 * @property {string|null} symbol
 * @property {string|null} botType
 * @property {string|null} status
 * @property {number|null} totalPnl
 * @property {number|null} gridProfit
 * @property {Object} totalPnlRule
 * @property {Object} gridProfitCaptureRule
 */

/**
 * @typedef {Object} PlanBotDto
 * @property {number} botPk
 * @property {string} botId
 * @property {string|null} symbol
 * @property {string|null} botType
 * @property {string|null} status
 * @property {number|null} equity
 * @property {number|null} totalPnl
 * @property {number|null} totalApr
 * @property {number|null} gridApr
 * @property {number|null} activityCount
 * @property {number|null} gridProfitPerDay
 * @property {number|null} workRuntimeSec
 * @property {string} statusHint
 * @property {boolean} isIncluded
 * @property {number} weight
 * @property {string|null} membershipUpdatedAt
 * @property {string|null} lastSeenAt
 */

/**
 * @typedef {Object} PlanDto
 * @property {number} planPk
 * @property {string} title
 * @property {number} targetDailyPnlUsd
 * @property {string} status
 * @property {string|null} notes
 * @property {string|null} createdAt
 * @property {string|null} updatedAt
 * @property {Object} summary
 * @property {PlanBotDto[]} participants
 */

function toBotListItemDto(row) {
  const timing = extractBybitTiming(row);
  return mapBotAnalytics({
    id: buildBotId(row),
    botPk: toNumber(row.bot_pk),
    bybitBotId: row.bybit_bot_id || null,
    symbol: row.symbol || null,
    botType: row.bot_type || null,
    status: row.status || null,
    equity: toNullableNumber(row.equity),
    totalPnl: toNullableNumber(row.total_pnl),
    totalApr: toNullableNumber(row.total_apr),
    gridApr: toNullableNumber(row.grid_apr),
    gridProfit: toNullableNumber(row.grid_profit),
    leverage: toNullableNumber(row.leverage),
    activityCount: toNullableNumber(row.activity_count),
    analyticsInvestment: toNullableNumber(row.analytics_investment),
    localPeakTotalPnl: toNullableNumber(row.local_peak_total_pnl),
    identityStatus: row.identity_status || "unknown",
    inferenceConfidence: toNullableNumber(row.inference_confidence),
    snapshotCount: toNumber(row.snapshot_count),
    openAlertCount: toNumber(row.open_alert_count),
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    lastSnapshotAt: row.last_snapshot_at || null,
    confirmedAt: row.confirmed_at || null,
    workStartedAt: timing.workStartedAt,
    workRuntimeSec: timing.workRuntimeSec,
    factPnlPerDay: toNullableNumber(row.factPnlPerDay),
  });
}

function toBotDetailsDto(botRow, latestSnapshotRow) {
  const latestSnapshotDto = latestSnapshotRow ? toBotSnapshotDto(latestSnapshotRow) : null;
  const timing = latestSnapshotRow ? extractBybitTiming(latestSnapshotRow) : { workStartedAt: null, workRuntimeSec: null };
  const analytics = latestSnapshotRow
    ? mapBotAnalytics({
        equity: toNullableNumber(latestSnapshotRow.equity),
        totalPnl: toNullableNumber(latestSnapshotRow.total_pnl),
        totalApr: toNullableNumber(latestSnapshotRow.total_apr),
        gridApr: toNullableNumber(latestSnapshotRow.grid_apr),
        activityCount: toNullableNumber(latestSnapshotRow.activity_count),
        investment: toNullableNumber(latestSnapshotRow.investment),
        runtimeStartedAt: botRow.confirmed_at || botRow.first_seen_at || null,
        runtimeEndedAt: latestSnapshotRow.snapshot_time || botRow.last_snapshot_at || null,
        workStartedAt: timing.workStartedAt,
        workRuntimeSec: timing.workRuntimeSec,
        factPnlPerDay: toNullableNumber(latestSnapshotRow.factPnlPerDay),
        localPeakTotalPnl: toNullableNumber(latestSnapshotRow.local_peak_total_pnl),
      })
    : null;

  return {
    id: buildBotId(botRow),
    botPk: toNumber(botRow.bot_pk),
    bybitBotId: botRow.bybit_bot_id || null,
    guessedKey: botRow.guessed_key || null,
    identityStatus: botRow.identity_status || "unknown",
    inferenceConfidence: toNullableNumber(botRow.inference_confidence),
    inferenceReason: botRow.inference_reason || null,
    symbol: botRow.symbol || null,
    botType: botRow.bot_type || null,
    status: botRow.status || null,
    route: botRow.route || null,
    source: botRow.source || null,
    isActive: toBoolean(botRow.is_active),
    firstSeenAt: botRow.first_seen_at || null,
    lastSeenAt: botRow.last_seen_at || null,
    confirmedAt: botRow.confirmed_at || null,
    lastSnapshotAt: botRow.last_snapshot_at || null,
    snapshotCount: toNumber(botRow.snapshot_count),
    openAlertCount: toNumber(botRow.open_alert_count),
    runtimeStartedAt: analytics?.runtimeStartedAt || botRow.confirmed_at || botRow.first_seen_at || null,
    runtimeSec: analytics?.runtimeSec ?? null,
    runtimeDays: analytics?.runtimeDays ?? null,
    annualizedRuntimeDays: analytics?.annualizedRuntimeDays ?? null,
    annualizedCapitalBase: analytics?.annualizedCapitalBase ?? null,
    derivedAnnualizedTotalYieldRatio: analytics?.derivedAnnualizedTotalYieldRatio ?? null,
    derivedAnnualizedStatus: analytics?.derivedAnnualizedStatus ?? "unavailable",
    workStartedAt: latestSnapshotDto?.workStartedAt ?? null,
    workRuntimeSec: latestSnapshotDto?.workRuntimeSec ?? null,
    leverage: latestSnapshotDto?.leverage ?? null,
    gridProfitPerDay: analytics?.gridProfitPerDay ?? null,
    factPnlPerDay: analytics?.factPnlPerDay ?? null,
    latestSnapshot: latestSnapshotDto,
  };
}

function toBotSnapshotDto(row) {
  const timing = extractBybitTiming(row);
  return mapBotAnalytics({
    snapshotId: toNumber(row.snapshot_id),
    snapshotTime: row.snapshot_time,
    source: row.source || "unknown",
    symbol: row.symbol || null,
    botType: row.bot_type || null,
    status: row.status || null,
    equity: toNullableNumber(row.equity),
    totalPnl: toNullableNumber(row.total_pnl),
    totalApr: toNullableNumber(row.total_apr),
    gridApr: toNullableNumber(row.grid_apr),
    leverage: toNullableNumber(row.leverage),
    gridProfit: toNullableNumber(row.grid_profit),
    activityCount: toNullableNumber(row.activity_count),
    investment: toNullableNumber(row.investment),
    localPeakTotalPnl: toNullableNumber(row.local_peak_total_pnl),
    runtimeStartedAt: row.confirmed_at || row.first_seen_at || null,
    runtimeEndedAt: row.snapshot_time,
    workStartedAt: timing.workStartedAt,
    workRuntimeSec: timing.workRuntimeSec,
    realizedPnl: toNullableNumber(row.realized_pnl),
    unrealizedPnl: toNullableNumber(row.unrealized_pnl),
    fundingFees: toNullableNumber(row.funding_fees),
    liquidationPrice: toNullableNumber(row.liquidation_price),
    totalOrderBalance: toNullableNumber(row.total_order_balance),
    availableBalance: toNullableNumber(row.available_balance),
    positionBalance: toNullableNumber(row.position_balance),
  });
}

function toDashboardSummaryDto(summaryRow, statusRows, botTypeRows) {
  return {
    totals: {
      totalBots: toNumber(summaryRow.total_bots),
      activeBots: toNumber(summaryRow.active_bots),
      inferredBots: toNumber(summaryRow.inferred_bots),
      openAlerts: toNumber(summaryRow.open_alerts),
      latestSnapshotTime: summaryRow.latest_snapshot_time || null,
      totalEquity: toNullableNumber(summaryRow.total_equity) ?? 0,
      totalPnl: toNullableNumber(summaryRow.total_pnl) ?? 0,
      averageTotalApr: toNullableNumber(summaryRow.average_total_apr),
      averageGridApr: toNullableNumber(summaryRow.average_grid_apr),
    },
    statusBreakdown: statusRows.map((row) => ({
      status: row.status || "UNKNOWN",
      botCount: toNumber(row.bot_count),
    })),
    botTypeBreakdown: botTypeRows.map((row) => ({
      botType: row.bot_type || "unknown",
      botCount: toNumber(row.bot_count),
    })),
  };
}

function toAlertDto(row) {
  return {
    alertPk: toNumber(row.alert_pk),
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    message: row.message || null,
    metricName: row.metric_name || null,
    metricValue: toNullableNumber(row.metric_value),
    thresholdValue: toNullableNumber(row.threshold_value),
    comparisonOperator: row.comparison_operator || null,
    source: row.source || null,
    alertTime: row.alert_time,
    acknowledgedAt: row.acknowledged_at || null,
    resolvedAt: row.resolved_at || null,
    bot: row.bot_pk
      ? {
          id: row.bybit_bot_id || `bot:${row.bot_pk}`,
          botPk: toNumber(row.bot_pk),
          bybitBotId: row.bybit_bot_id || null,
          symbol: row.symbol || null,
          botType: row.bot_type || null,
        }
      : null,
  };
}

function toHealthDto(summaryRow, dbPath, startedAt) {
  return {
    status: "ok",
    time: new Date().toISOString(),
    uptimeSec: getUptimeSec(startedAt),
    database: {
      path: dbPath,
      reachable: true,
      totalBots: toNumber(summaryRow.total_bots),
      totalSnapshots: toNumber(summaryRow.total_snapshots),
      openAlerts: toNumber(summaryRow.open_alerts),
      latestSnapshotTime: summaryRow.latest_snapshot_time || null,
    },
  };
}

function toMetricsDto(metricsRow, dbPath, startedAt) {
  return {
    time: new Date().toISOString(),
    uptimeSec: getUptimeSec(startedAt),
    database: {
      path: dbPath,
      latestSnapshotTime: metricsRow.latest_snapshot_time || null,
    },
    counters: {
      totalBots: toNumber(metricsRow.total_bots),
      activeBots: toNumber(metricsRow.active_bots),
      inferredBots: toNumber(metricsRow.inferred_bots),
      totalSnapshots: toNumber(metricsRow.total_snapshots),
      snapshotsLast24h: toNumber(metricsRow.snapshots_last_24h),
      totalAlerts: toNumber(metricsRow.total_alerts),
      openAlerts: toNumber(metricsRow.open_alerts),
      criticalOpenAlerts: toNumber(metricsRow.critical_open_alerts),
      totalOrders: toNumber(metricsRow.total_orders),
      totalExecutions: toNumber(metricsRow.total_executions),
    },
  };
}

function toServiceStatusDto(row, serviceName) {
  const lastSuccessAt = row?.last_success_at || null;
  const staleSec = lastSuccessAt ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccessAt).getTime()) / 1000)) : null;
  const isStale = staleSec === null ? true : staleSec > 15 * 60;
  return {
    serviceName,
    status: row?.status || "unknown",
    lastStartedAt: row?.last_started_at || null,
    lastFinishedAt: row?.last_finished_at || null,
    lastSuccessAt,
    lastErrorAt: row?.last_error_at || null,
    lastErrorMessage: row?.last_error_message || null,
    lastSnapshotTime: row?.last_snapshot_time || null,
    lastActiveBots: toNullableNumber(row?.last_active_bots),
    lastSnapshotsInserted: toNullableNumber(row?.last_snapshots_inserted),
    updatedAt: row?.updated_at || null,
    staleSec,
    isStale,
  };
}

function toTelegramAlertSettingsDto(settingRow) {
  const settings = settingRow?.value || {};
  const botToken = typeof settings.botToken === "string" ? settings.botToken : "";

  return {
    enabled: Boolean(settings.enabled),
    chatId: typeof settings.chatId === "string" && settings.chatId.trim() ? settings.chatId.trim() : null,
    minSeverity: normalizeSeverity(settings.minSeverity),
    sendResolved: Boolean(settings.sendResolved),
    tradeActivityNotificationsEnabled: Boolean(settings.tradeActivityNotificationsEnabled),
    tradeActivityMutedBotIds: Array.isArray(settings.tradeActivityMutedBotIds)
      ? settings.tradeActivityMutedBotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [],
    hasBotToken: botToken.length > 0,
    botTokenMasked: botToken.length > 0 ? maskToken(botToken) : null,
    updatedAt: settingRow?.updated_at || null,
  };
}

function toBotAlertRuleDto(row) {
  return {
    botPk: toNumber(row.bot_pk),
    botId: row.bybit_bot_id || `bot:${row.bot_pk}`,
    symbol: row.symbol || null,
    botType: row.bot_type || null,
    status: row.status || null,
    totalPnl: toNullableNumber(row.total_pnl),
    gridProfit: toNullableNumber(row.grid_profit),
    totalPnlRule: {
      enabled: Number(row.total_is_enabled) === 1,
      comparisonOperator: row.total_comparison_operator || "lte",
      thresholdValue: toNullableNumber(row.total_threshold_value),
      severity: ["info", "warning", "critical"].includes(row.total_severity) ? row.total_severity : "warning",
      title: row.total_title || null,
      lastTriggeredAt: row.total_last_triggered_at || null,
      updatedAt: row.total_updated_at || null,
    },
    gridProfitCaptureRule: {
      enabled: Number(row.grid_is_enabled) === 1,
      severity: ["info", "warning", "critical"].includes(row.grid_severity) ? row.grid_severity : "warning",
      title: row.grid_title || null,
      lastTriggeredAt: row.grid_last_triggered_at || null,
      updatedAt: row.grid_updated_at || null,
    },
  };
}

function toPlanDto(planRow, participantRows, snapshotRows = []) {
  const participants = participantRows.map((row) => {
    const timing = extractBybitTiming(row);
    const analytics = mapBotAnalytics({
      botPk: toNumber(row.bot_pk),
      id: buildBotId(row),
      symbol: row.symbol || null,
      botType: row.bot_type || null,
      status: row.status || null,
      equity: toNullableNumber(row.equity),
      totalPnl: toNullableNumber(row.total_pnl),
      totalApr: toNullableNumber(row.total_apr),
      gridApr: toNullableNumber(row.grid_apr),
      activityCount: toNullableNumber(row.activity_count),
      analyticsInvestment: toNullableNumber(row.analytics_investment),
      localPeakTotalPnl: toNullableNumber(row.local_peak_total_pnl),
      firstSeenAt: row.first_seen_at || null,
      lastSeenAt: row.last_seen_at || null,
      lastSnapshotAt: row.last_snapshot_at || null,
      confirmedAt: row.confirmed_at || null,
      workStartedAt: timing.workStartedAt,
      workRuntimeSec: timing.workRuntimeSec,
      isIncluded: Number(row.is_included) === 1,
      weight: toNullableNumber(row.weight) ?? 1,
      membershipUpdatedAt: row.membership_updated_at || null,
    });

    return {
      botPk: analytics.botPk,
      botId: analytics.id,
      symbol: analytics.symbol,
      botType: analytics.botType,
      status: analytics.status,
      equity: analytics.equity,
      totalPnl: analytics.totalPnl,
      totalApr: analytics.totalApr,
      gridApr: analytics.gridApr,
      activityCount: analytics.activityCount,
      gridProfitPerDay: analytics.gridProfitPerDay,
      workRuntimeSec: analytics.workRuntimeSec,
      statusHint: analytics.statusHint,
      isIncluded: Boolean(analytics.isIncluded),
      weight: analytics.weight ?? 1,
      membershipUpdatedAt: analytics.membershipUpdatedAt,
      lastSeenAt: analytics.lastSeenAt,
    };
  });

  const included = participants.filter((item) => item.isIncluded);
  const targetDailyPnlUsd = toNullableNumber(planRow?.target_daily_pnl_usd) ?? 30;
  const currentEstimatedDailyPnlUsd = sumBy(included, (item) => item.gridProfitPerDay);
  const currentTotalPnlUsd = sumBy(included, (item) => item.totalPnl);
  const totalEquityUsd = sumBy(included, (item) => item.equity);
  const progressRatio = targetDailyPnlUsd > 0 ? currentEstimatedDailyPnlUsd / targetDailyPnlUsd : null;
  const estimatedDailyYieldRatio =
    totalEquityUsd > 0 ? currentEstimatedDailyPnlUsd / totalEquityUsd : null;
  const requiredCapitalUsd =
    estimatedDailyYieldRatio && estimatedDailyYieldRatio > 0
      ? targetDailyPnlUsd / estimatedDailyYieldRatio
      : null;
  const additionalCapitalNeededUsd =
    requiredCapitalUsd === null ? null : Math.max(0, requiredCapitalUsd - totalEquityUsd);

  return {
    planPk: toNumber(planRow?.plan_pk),
    title: planRow?.title || "План дохода",
    targetDailyPnlUsd,
    status: planRow?.status || "active",
    notes: planRow?.notes || null,
    createdAt: planRow?.created_at || null,
    updatedAt: planRow?.updated_at || null,
    summary: {
      includedBots: included.length,
      totalBots: participants.length,
      activeIncludedBots: included.filter((item) => String(item.status || "").includes("RUNNING")).length,
      currentEstimatedDailyPnlUsd,
      currentTotalPnlUsd,
      totalEquityUsd,
      gapToTargetUsd: currentEstimatedDailyPnlUsd - targetDailyPnlUsd,
      progressRatio,
      estimatedDailyYieldRatio,
      requiredCapitalUsd,
      additionalCapitalNeededUsd,
      performanceWindows: buildPlanPerformanceWindows(snapshotRows, targetDailyPnlUsd),
    },
    participants,
  };
}

function buildBotId(row) {
  return row.bybit_bot_id || `bot:${row.bot_pk}`;
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value) {
  return Number(value) === 1;
}

function getUptimeSec(startedAt) {
  return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

function mapBotAnalytics(row) {
  const analytics = withBotAnalytics({
    total_apr: row.totalApr ?? null,
    grid_apr: row.gridApr ?? null,
    total_pnl: row.totalPnl ?? null,
    equity: row.equity ?? null,
    investment: row.analyticsInvestment ?? row.investment ?? null,
    activity_count: row.activityCount ?? null,
    local_peak_total_pnl: row.localPeakTotalPnl ?? null,
    runtime_started_at: row.runtimeStartedAt ?? row.confirmedAt ?? row.firstSeenAt ?? null,
    runtime_ended_at: row.runtimeEndedAt ?? row.lastSnapshotAt ?? null,
    work_started_at: row.workStartedAt ?? null,
    work_runtime_sec: row.workRuntimeSec ?? null,
  });

  const {
    localPeakTotalPnl: _localPeakTotalPnl,
    runtimeEndedAt: _runtimeEndedAt,
    confirmedAt: _confirmedAt,
    analyticsInvestment: _analyticsInvestment,
    ...dtoRow
  } = row;
  return {
    ...dtoRow,
    pnlGap: analytics.pnl_gap,
    pnlToEquityRatio: analytics.pnl_to_equity_ratio,
    activityScore: analytics.activity_score,
    drawdownFromLocalPeak: analytics.drawdown_from_local_peak,
    runtimeStartedAt: analytics.runtime_started_at,
    runtimeSec: analytics.runtime_sec,
    runtimeDays: analytics.runtime_days,
    annualizedRuntimeDays: analytics.annualized_runtime_days,
    annualizedCapitalBase: analytics.annualized_capital_base,
    derivedAnnualizedTotalYieldRatio: analytics.derived_annualized_total_yield_ratio,
    derivedAnnualizedStatus: analytics.derived_annualized_status,
    workStartedAt: row.workStartedAt ?? null,
    workRuntimeSec: row.workRuntimeSec ?? null,
    gridProfitPerDay: analytics.grid_profit_per_day,
    factPnlPerDay: row.factPnlPerDay ?? analytics.fact_pnl_per_day,
    statusHint: analytics.status_hint,
  };
}

function extractBybitTiming(row) {
  const createTime = row?.create_time || null;
  const operationTimeMs = toNullableNumber(row?.operation_time_ms);

  if (createTime || operationTimeMs !== null) {
    return {
      workStartedAt: createTime,
      workRuntimeSec: operationTimeMs === null ? null : Math.max(0, Math.round(operationTimeMs / 1000)),
    };
  }

  const rawPayloadJson = row?.raw_payload_json;
  if (!rawPayloadJson) {
    return {
      workStartedAt: null,
      workRuntimeSec: null,
    };
  }

  try {
    const payload = JSON.parse(rawPayloadJson);
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

function normalizeSeverity(value) {
  return ["info", "warning", "critical"].includes(value) ? value : "warning";
}

function maskToken(value) {
  if (value.length <= 8) {
    return "••••";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function sumBy(items, getValue) {
  return items.reduce((sum, item) => sum + (toNullableNumber(getValue(item)) ?? 0), 0);
}

function buildPlanPerformanceWindows(snapshotRows, targetDailyPnlUsd) {
  const dayMs = 24 * 60 * 60 * 1000;
  const windows = [
    { key: "1d", label: "1 день", requestedDays: 1 },
    { key: "7d", label: "7 дней", requestedDays: 7 },
    { key: "30d", label: "30 дней", requestedDays: 30 },
    { key: "90d", label: "90 дней", requestedDays: 90 },
  ];

  const rows = snapshotRows
    .map((row) => ({
      botPk: toNumber(row.bot_pk),
      snapshotTime: row.snapshot_time,
      timestampMs: Date.parse(row.snapshot_time),
      totalPnl: toNullableNumber(row.total_pnl),
      equity: toNullableNumber(row.equity),
    }))
    .filter((row) => Number.isFinite(row.timestampMs));

  const latestTimestampMs = rows.length > 0
    ? Math.max(...rows.map((row) => row.timestampMs))
    : Date.now();

  return windows.map((window) => {
    const threshold = latestTimestampMs - window.requestedDays * dayMs;
    const rowsInWindow = rows.filter((row) => row.timestampMs >= threshold);
    const grouped = groupByBot(rowsInWindow);
    const pnlDeltaUsd = grouped.reduce((sum, group) => {
      if (group.length < 2) {
        return sum;
      }

      const pnlRows = group.filter((row) => row.totalPnl !== null);
      if (pnlRows.length < 2) {
        return sum;
      }

      const start = pnlRows[0];
      const end = pnlRows[pnlRows.length - 1];
      return sum + (end.totalPnl - start.totalPnl);
    }, 0);

    const timestamps = rowsInWindow.map((row) => row.timestampMs);
    const observedDays =
      timestamps.length >= 2
        ? Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / dayMs)
        : 0;
    const rowsWithEquity = rowsInWindow.filter((row) => row.equity !== null);
    const avgCapitalUsd =
      rowsWithEquity.length > 0
        ? sumBy(rowsWithEquity, (row) => row.equity) / rowsWithEquity.length
        : null;
    const avgDailyPnlUsd = observedDays > 0 ? pnlDeltaUsd / observedDays : null;
    const dailyYieldRatio =
      avgCapitalUsd && avgCapitalUsd > 0 && avgDailyPnlUsd !== null
        ? avgDailyPnlUsd / avgCapitalUsd
        : null;
    const requiredCapitalUsd =
      dailyYieldRatio && dailyYieldRatio > 0 ? targetDailyPnlUsd / dailyYieldRatio : null;

    return {
      key: window.key,
      label: window.label,
      requestedDays: window.requestedDays,
      observedDays: roundMetric(observedDays),
      coverageRatio: window.requestedDays > 0 ? roundMetric(Math.min(1, observedDays / window.requestedDays)) : null,
      avgDailyPnlUsd: roundMetric(avgDailyPnlUsd),
      avgCapitalUsd: roundMetric(avgCapitalUsd),
      dailyYieldRatio: roundMetric(dailyYieldRatio),
      requiredCapitalUsd: roundMetric(requiredCapitalUsd),
    };
  });
}

function groupByBot(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (!map.has(row.botPk)) {
      map.set(row.botPk, []);
    }

    map.get(row.botPk).push(row);
  });

  return [...map.values()];
}

function roundMetric(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}

module.exports = {
  toAlertDto,
  toBotDetailsDto,
  toBotListItemDto,
  toBotSnapshotDto,
  toDashboardSummaryDto,
  toHealthDto,
  toMetricsDto,
  toPlanDto,
  toServiceStatusDto,
  toBotAlertRuleDto,
  toTelegramAlertSettingsDto,
};
