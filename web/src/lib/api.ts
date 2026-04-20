import type {
  AlertItem,
  ApiResponse,
  BotDetails,
  BotMarketChart,
  BotListItem,
  BotSnapshot,
  BotAlertRule,
  BotAlertRuleInput,
  DashboardSummary,
  HealthStatus,
  Plan,
  PlanBotUpdateInput,
  PlanUpdateInput,
  ClosedBotsHistory,
  PeriodSummary,
  ServiceStatus,
  StatsExclusionUpdateInput,
  TelegramAlertSettings,
  TelegramAlertSettingsInput,
} from "@lib/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function getBots() {
  return request<ApiResponse<BotListItem[]>>("/bots");
}

export async function getBot(botId: string) {
  return request<ApiResponse<BotDetails>>(`/bots/${encodeURIComponent(botId)}`);
}

export async function getBotMarketChart(
  botId: string,
  options?: {
    interval?: "15" | "60" | "240" | "D" | "W";
    range?: "24h" | "7d" | "30d" | "90d" | "1y" | "lifetime";
    priceSource?: "market" | "mark" | "index";
  },
) {
  const search = new URLSearchParams();
  if (options?.interval) {
    search.set("interval", options.interval);
  }
  if (options?.range) {
    search.set("range", options.range);
  }
  if (options?.priceSource) {
    search.set("priceSource", options.priceSource);
  }

  const suffix = search.size ? `?${search.toString()}` : "";
  return request<ApiResponse<BotMarketChart>>(`/bots/${encodeURIComponent(botId)}/market-chart${suffix}`);
}

export async function getBotSnapshots(botId: string) {
  return request<ApiResponse<BotSnapshot[]>>(`/bots/${encodeURIComponent(botId)}/snapshots`);
}

export async function getDashboardSummary() {
  return request<ApiResponse<DashboardSummary>>("/dashboard/summary");
}

export async function getAlerts(limit = 6) {
  return request<ApiResponse<AlertItem[]>>(`/alerts?limit=${limit}`);
}

export async function acknowledgeAlert(alertPk: number) {
  return request<ApiResponse<AlertItem>>(`/alerts/${alertPk}/acknowledge`, {
    method: "PUT",
  });
}

export async function suppressAlert(alertPk: number) {
  return request<ApiResponse<AlertItem>>(`/alerts/${alertPk}/suppress`, {
    method: "PUT",
  });
}

export async function getServiceStatus() {
  return request<ApiResponse<ServiceStatus>>("/service/status");
}

export async function getHealth() {
  return request<ApiResponse<HealthStatus>>("/health");
}

export async function getTelegramAlertSettings() {
  return request<ApiResponse<TelegramAlertSettings>>("/settings/telegram-alerts");
}

export async function updateTelegramAlertSettings(payload: TelegramAlertSettingsInput) {
  return request<ApiResponse<TelegramAlertSettings>>("/settings/telegram-alerts", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function sendTestTradeNotification(botId: string) {
  return request<ApiResponse<{ sent: boolean; botId: string }>>(`/settings/telegram-alerts/test-trade/${encodeURIComponent(botId)}`, {
    method: "PUT",
  });
}

export async function getBotAlertRules() {
  return request<ApiResponse<BotAlertRule[]>>("/settings/alert-rules");
}

export async function updateBotTotalPnlRule(botId: string, payload: BotAlertRuleInput) {
  return request<ApiResponse<BotAlertRule>>(`/settings/alert-rules/${encodeURIComponent(botId)}/total-pnl`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateBotGridProfitCaptureRule(botId: string, payload: BotAlertRuleInput) {
  return request<ApiResponse<BotAlertRule>>(`/settings/alert-rules/${encodeURIComponent(botId)}/grid-profit-capture`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentPlan() {
  return request<ApiResponse<Plan>>("/plans/current");
}

export async function getClosedBotsHistory() {
  return request<ApiResponse<ClosedBotsHistory>>("/history/closed-bots");
}

export async function getPeriodSummary(windowKey: string, composition: string) {
  const search = new URLSearchParams({
    window: windowKey,
    composition,
  });

  return request<ApiResponse<PeriodSummary>>(`/summary/period?${search.toString()}`);
}

export async function updateBotStatsExclusion(botId: string, payload: StatsExclusionUpdateInput) {
  return request<ApiResponse<unknown>>(`/stats/exclusions/bots/${encodeURIComponent(botId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateClosedRunStatsExclusion(closedRunPk: number, payload: StatsExclusionUpdateInput) {
  return request<ApiResponse<unknown>>(`/stats/exclusions/closed-runs/${closedRunPk}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateCurrentPlan(payload: PlanUpdateInput) {
  return request<ApiResponse<Plan>>("/plans/current", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function updateCurrentPlanBot(botId: string, payload: PlanBotUpdateInput) {
  return request<ApiResponse<Plan>>(`/plans/current/bots/${encodeURIComponent(botId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (typeof json?.message === "string" && json.message) ||
      (Array.isArray(json?.message) && json.message.filter((item: unknown) => typeof item === "string").join(", ")) ||
      (typeof json?.error?.message === "string" && json.error.message) ||
      (typeof json?.error === "string" && json.error) ||
      `Ошибка запроса: ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}
