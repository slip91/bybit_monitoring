export type StatusHint =
  | "overall_green"
  | "grid_works_position_hurts"
  | "weak_activity"
  | "high_drawdown"
  | "unknown";

export type ExclusionReason =
  | "experiment"
  | "technical"
  | "duplicate"
  | "invalid_data"
  | "manual_ignore"
  | "migration"
  | "other";

export type BotListItem = {
  id: string;
  botPk: number;
  bybitBotId: string | null;
  symbol: string | null;
  botType: string | null;
  status: string | null;
  equity: number | null;
  totalPnl: number | null;
  totalApr: number | null;
  gridApr: number | null;
  gridProfit: number | null;
  leverage: number | null;
  activityCount: number | null;
  pnlGap: number | null;
  pnlToEquityRatio: number | null;
  activityScore: number | null;
  drawdownFromLocalPeak: number | null;
  runtimeStartedAt: string | null;
  runtimeSec: number | null;
  runtimeDays: number | null;
  annualizedRuntimeDays: number | null;
  annualizedCapitalBase: number | null;
  derivedAnnualizedTotalYieldRatio: number | null;
  derivedAnnualizedStatus: "stable" | "preliminary" | "unstable" | "unavailable";
  workStartedAt: string | null;
  workRuntimeSec: number | null;
  gridProfitPerDay: number | null;
  factPnlPerDay: number | null;
  statusHint: StatusHint;
  identityStatus: string;
  inferenceConfidence: number | null;
  snapshotCount: number;
  openAlertCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastSnapshotAt: string | null;
};

export type BotSnapshot = {
  snapshotId: number;
  snapshotTime: string;
  source: string;
  symbol: string | null;
  botType: string | null;
  status: string | null;
  equity: number | null;
  totalPnl: number | null;
  totalApr: number | null;
  gridApr: number | null;
  leverage: number | null;
  activityCount: number | null;
  pnlGap: number | null;
  pnlToEquityRatio: number | null;
  activityScore: number | null;
  drawdownFromLocalPeak: number | null;
  runtimeStartedAt: string | null;
  runtimeSec: number | null;
  runtimeDays: number | null;
  annualizedRuntimeDays: number | null;
  annualizedCapitalBase: number | null;
  derivedAnnualizedTotalYieldRatio: number | null;
  derivedAnnualizedStatus: "stable" | "preliminary" | "unstable" | "unavailable";
  workStartedAt: string | null;
  workRuntimeSec: number | null;
  gridProfitPerDay: number | null;
  factPnlPerDay: number | null;
  statusHint: StatusHint;
  investment: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  fundingFees: number | null;
  liquidationPrice: number | null;
  totalOrderBalance: number | null;
  availableBalance: number | null;
  positionBalance: number | null;
  gridProfit: number | null;
};

export type BotDetails = {
  id: string;
  botPk: number;
  bybitBotId: string | null;
  guessedKey: string | null;
  identityStatus: string;
  inferenceConfidence: number | null;
  inferenceReason: string | null;
  symbol: string | null;
  botType: string | null;
  leverage: number | null;
  status: string | null;
  route: string | null;
  source: string | null;
  isActive: boolean;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  confirmedAt: string | null;
  lastSnapshotAt: string | null;
  snapshotCount: number;
  openAlertCount: number;
  runtimeStartedAt: string | null;
  runtimeSec: number | null;
  runtimeDays: number | null;
  annualizedRuntimeDays: number | null;
  annualizedCapitalBase: number | null;
  derivedAnnualizedTotalYieldRatio: number | null;
  derivedAnnualizedStatus: "stable" | "preliminary" | "unstable" | "unavailable";
  workStartedAt: string | null;
  workRuntimeSec: number | null;
  gridProfitPerDay: number | null;
  factPnlPerDay: number | null;
  latestSnapshot: BotSnapshot | null;
};

export type BotMarketChart = {
  botId: string;
  symbol: string;
  startedAt: string | null;
  interval: string;
  range: "24h" | "7d" | "30d" | "90d" | "1y" | "lifetime";
  priceSource: "market" | "mark" | "index";
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  overlays: {
    currentPrice: number | null;
    entryPrice: number | null;
    lowerRangePrice: number | null;
    upperRangePrice: number | null;
    takeProfitPrice: number | null;
    stopLossPrice: number | null;
    markPrice: number | null;
  };
  grid: {
    count: number | null;
  };
};

export type DashboardSummary = {
  totals: {
    totalBots: number;
    activeBots: number;
    inferredBots: number;
    openAlerts: number;
    latestSnapshotTime: string | null;
    totalEquity: number;
    totalPnl: number;
    averageTotalApr: number | null;
    averageGridApr: number | null;
  };
  statusBreakdown: Array<{
    status: string;
    botCount: number;
  }>;
  botTypeBreakdown: Array<{
    botType: string;
    botCount: number;
  }>;
};

export type AlertItem = {
  alertPk: number;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string | null;
  metricName: string | null;
  metricValue: number | null;
  thresholdValue: number | null;
  comparisonOperator: string | null;
  source: string | null;
  alertTime: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  bot: {
    id: string;
    botPk: number;
    bybitBotId: string | null;
    symbol: string | null;
    botType: string | null;
  } | null;
};

export type ServiceStatus = {
  serviceName: string;
  status: string;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSnapshotTime: string | null;
  lastActiveBots: number | null;
  lastSnapshotsInserted: number | null;
  updatedAt: string | null;
  staleSec: number | null;
  isStale: boolean;
};

export type HealthStatus = {
  status: string;
  time: string;
  uptimeSec: number;
  database: {
    path: string;
    reachable: boolean;
    totalBots: number;
    totalSnapshots: number;
    openAlerts: number;
    latestSnapshotTime: string | null;
  };
};

export type TelegramAlertSettings = {
  enabled: boolean;
  chatId: string | null;
  minSeverity: "info" | "warning" | "critical";
  sendResolved: boolean;
  tradeActivityNotificationsEnabled: boolean;
  tradeActivityMutedBotIds: Array<string>;
  hasBotToken: boolean;
  botTokenMasked: string | null;
  updatedAt: string | null;
};

export type TelegramAlertSettingsInput = {
  enabled: boolean;
  botToken?: string;
  chatId: string;
  minSeverity: "info" | "warning" | "critical";
  sendResolved: boolean;
  tradeActivityNotificationsEnabled: boolean;
  tradeActivityMutedBotIds: Array<string>;
};

export type BotAlertRule = {
  botPk: number;
  botId: string;
  symbol: string | null;
  botType: string | null;
  status: string | null;
  totalPnl: number | null;
  gridProfit: number | null;
  totalPnlRule: {
    enabled: boolean;
    comparisonOperator: "lte" | "gte";
    thresholdValue: number | null;
    severity: "info" | "warning" | "critical";
    title: string | null;
    lastTriggeredAt: string | null;
    updatedAt: string | null;
  };
  gridProfitCaptureRule: {
    enabled: boolean;
    severity: "info" | "warning" | "critical";
    title: string | null;
    lastTriggeredAt: string | null;
    updatedAt: string | null;
  };
};

export type BotAlertRuleInput = {
  enabled: boolean;
  severity: "info" | "warning" | "critical";
  comparisonOperator?: "lte" | "gte";
  thresholdValue?: number | null;
  title?: string;
};

export type PlanParticipant = {
  botPk: number;
  botId: string;
  symbol: string | null;
  botType: string | null;
  leverage: number | null;
  status: string | null;
  equity: number | null;
  totalPnl: number | null;
  totalApr: number | null;
  gridApr: number | null;
  activityCount: number | null;
  currentGridProfit: number | null;
  gridProfitPerDay: number | null;
  aprIncomePerDay?: number | null;
  estimatedIncomePerDay: number | null;
  runtimeIncomePerDay: number | null;
  estimateSource?: "runtime" | "apr" | null;
  workRuntimeSec: number | null;
  statusHint: StatusHint;
  isIncluded: boolean;
  isActive: boolean;
  excludeFromPlan: boolean;
  excludeFromPeriodStats: boolean;
  excludeReason: ExclusionReason | null;
  excludeNote?: string | null;
  weight: number;
  membershipUpdatedAt: string | null;
  lastSeenAt: string | null;
  planCategory: "active_in_plan" | "active_out_of_plan" | "closed";
  actualIncomePerDay: number | null;
  actualObservationDays: number | null;
  actualObservationCoverage: number | null;
  contributionBasis: "runtime" | "apr" | "actual" | null;
  contributionToTargetRatio: number | null;
  contributionStatus: "strong" | "medium" | "weak" | "drag";
  contributionUsd?: number | null;
  contributionShare?: number | null;
  normalizedIncomePer100Usd?: number | null;
};

export type Plan = {
  planPk: number;
  title: string;
  targetDailyPnlUsd: number;
  status: "active" | "paused" | "archived";
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  summary: {
    includedBots: number;
    totalBots: number;
    activeIncludedBots: number;
    currentEstimatedDailyPnlUsd: number;
    currentTotalPnlUsd: number;
    totalEquityUsd: number;
    gapToTargetUsd: number;
    progressRatio: number | null;
    estimatedDailyYieldRatio: number | null;
    requiredCapitalUsd: number | null;
    additionalCapitalNeededUsd: number | null;
    targetDailyIncome: number;
    estimatedDailyIncome: number | null;
    actualDailyIncome: number | null;
    deficitToTarget: number | null;
    percentOfTarget: number | null;
    participatingBotsCount: number;
    currentPlanCapital: number | null;
    requiredCapital: number | null;
    missingCapital: number | null;
    observationCoverage: number | null;
    confidenceLevel: "low" | "medium" | "high";
    confidenceReasons: Array<string>;
    estimatedBotsCoverage: number | null;
    actualBotsCoverage: number | null;
    botsWithEstimateDataCount: number;
    botsWithRuntimeEstimateCount?: number;
    botsWithAprFallbackCount?: number;
    botsWithActualDataCount: number;
    allActiveBotsCount: number;
    activeBotsOutsidePlanCount: number;
    closedBotsCount: number;
    closedBotsInPlanCount: number;
    excludedBotsCount: number;
    performanceWindows: Array<{
      key: string;
      label: string;
      requestedDays: number;
      observedDays: number | null;
      coverageRatio: number | null;
      avgDailyPnlUsd: number | null;
      avgCapitalUsd: number | null;
      dailyYieldRatio: number | null;
      requiredCapitalUsd: number | null;
      missingCapitalUsd: number | null;
      eligibleBotsCount: number;
      botsWithActualDataCount: number;
      botCoverageRatio: number | null;
      confidenceLevel: "low" | "medium" | "high";
      confidenceReasons: Array<string>;
    }>;
  };
  participants: PlanParticipant[];
};

export type PlanUpdateInput = {
  title: string | null;
  targetDailyPnlUsd: number | null;
  status: "active" | "paused" | "archived";
  notes: string | null;
};

export type PlanBotUpdateInput = {
  isIncluded: boolean;
  weight?: number | null;
  excludeFromPlan?: boolean;
};

export type ClosedBotsHistory = {
  summary: {
    closedBotsCount: number;
    totalFinalPnl: number | null;
    totalRealizedPnl: number | null;
    profitableClosedBots: number;
    losingClosedBots: number;
    avgPnlPer100Usd: number | null;
    avgPnlPerDay: number | null;
    avgLifetimeDays: number | null;
    realizedPnlCoverageRatio: number | null;
    lifetimeCoverageRatio: number | null;
    closeReasonCoverageRatio: number | null;
    strategyTagCoverageRatio: number | null;
    realizedPnlStatus: "available" | "incomplete" | "unavailable";
    lifetimeStatus: "available" | "incomplete" | "unavailable";
    closeReasonStatus: "available" | "incomplete" | "unavailable";
    strategyTagStatus: "available" | "incomplete" | "unavailable";
    excludedRunsCount: number;
    usesFinalPnlProxy: boolean;
  };
  items: Array<{
    closedRunPk: number;
    legacyBotId: string;
    botPk: number | null;
    symbol: string | null;
    botType: string;
    leverage: number | null;
    strategyTag: string | null;
    closeReason: string | null;
    closeReasonDetail: string | null;
    startedAt: string | null;
    closedAt: string | null;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    snapshotCount: number;
    investment: number | null;
    realizedPnl: number | null;
    realizedPnlStatus: "available" | "unavailable";
    unrealizedPnl: number | null;
    totalPnl: number | null;
    finalPnl: number | null;
    averagePnlPerDay: number | null;
    equityAtClose: number | null;
    lifetimeDays: number | null;
    lifetimeStatus: "available" | "unavailable";
    source: string;
    profitabilityStatus: "profit" | "loss" | "flat" | "unknown";
    closeReasonStatus: "available" | "unavailable";
    strategyTagStatus: "available" | "unavailable";
    excludeFromPeriodStats: boolean;
    excludeFromClosedStats: boolean;
    excludeReason: ExclusionReason | null;
    excludeNote?: string | null;
  }>;
};

export type PeriodSummary = {
  window: {
    key: "1d" | "7d" | "30d" | "90d" | "500d" | "all";
    label: string;
    requestedDays: number | null;
    periodStart: string | null;
    periodEnd: string | null;
    observedDays: number | null;
    coverageRatio: number | null;
    coverageStatus: "available" | "incomplete" | "unavailable";
  };
  composition: {
    key: "active" | "combined" | "closed";
    label: string;
  };
  summary: {
    netPnl: number | null;
    realizedPnl: number | null;
    combinedPnl: number | null;
    averagePnlPerDay: number | null;
    averagePnlPerDayStatus: "available" | "incomplete" | "unavailable";
    confidenceLevel: "low" | "medium" | "high";
    botsInvolvedCount: number;
    activeBotsCount: number;
    closedBotsCount: number;
    excludedBotsCount: number;
    excludedRunsCount: number;
    profitableBotsCount: number;
    losingBotsCount: number;
    bestBot: {
      botId: string;
      symbol: string | null;
      leverage: number | null;
      sourceKind: "active" | "closed";
      combinedPnl: number | null;
      realizedPnl: number | null;
      profitabilityStatus: "profit" | "loss" | "flat" | "unknown";
    } | null;
    worstBot: {
      botId: string;
      symbol: string | null;
      leverage: number | null;
      sourceKind: "active" | "closed";
      combinedPnl: number | null;
      realizedPnl: number | null;
      profitabilityStatus: "profit" | "loss" | "flat" | "unknown";
    } | null;
    realizedPnlCoverageRatio: number | null;
    realizedPnlStatus: "available" | "incomplete" | "unavailable";
    lifetimeCoverageRatio: number | null;
    lifetimeStatus: "available" | "incomplete" | "unavailable";
    usesFinalPnlProxy: boolean;
    notes: Array<string>;
  };
  items: Array<{
    key: string;
    sourceKind: "active" | "closed";
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
    realizedPnlStatus: "available" | "incomplete" | "unavailable";
    lifetimeStatus: "available" | "incomplete" | "unavailable";
    dataQualityStatus: "available" | "incomplete" | "unavailable";
    excludeFromPeriodStats: boolean;
    excludeFromClosedStats: boolean;
    excludeReason: ExclusionReason | null;
    excludeNote?: string | null;
    profitabilityStatus: "profit" | "loss" | "flat" | "unknown";
  }>;
};

export type StatsExclusionUpdateInput = {
  excludeFromPlan?: boolean;
  excludeFromPeriodStats?: boolean;
  excludeFromClosedStats?: boolean;
  excludeReason?: ExclusionReason | null;
  excludeNote?: string | null;
};

export type ApiResponse<T> = {
  data: T;
  meta?: {
    count?: number;
    limit?: number;
    botId?: string;
  };
};
