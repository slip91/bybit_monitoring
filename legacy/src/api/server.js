const http = require("node:http");

const { listBotAlertRules, upsertTotalPnlRule } = require("../alerts/rules");
const { getRuntimeConfig } = require("../config/runtime");
const {
  getCurrentPlan,
  getBotById,
  getBotSnapshots,
  getDashboardBotTypeBreakdown,
  getDashboardStatusBreakdown,
  getDashboardSummary,
  acknowledgeAlert,
  getAlertById,
  getHealthSummary,
  getApiMetrics,
  getLatestBotSnapshot,
  getServiceStatus,
  listCurrentPlanBots,
  listCurrentPlanSnapshots,
  listBots,
  listRecentAlerts,
  suppressAlert,
} = require("../db/apiStore");
const {
  ensureCurrentPlan,
  ensureCurrentPlanMemberships,
  ensureWarehouseSchema,
  getJsonSetting,
  upsertCurrentPlan,
  upsertJsonSetting,
  upsertPlanBotMembership,
} = require("../db/warehouse");
const {
  toAlertDto,
  toBotDetailsDto,
  toBotAlertRuleDto,
  toBotListItemDto,
  toBotSnapshotDto,
  toDashboardSummaryDto,
  toHealthDto,
  toMetricsDto,
  toPlanDto,
  toServiceStatusDto,
  toTelegramAlertSettingsDto,
} = require("./dto");

const SNAPSHOT_SERVICE_NAME = "snapshot_active_bots";
const TELEGRAM_ALERT_SETTINGS_KEY = "telegram_alert_settings";

function createApiServer(options = {}) {
  const config = options.config || getRuntimeConfig();
  const startedAt = options.startedAt || new Date();
  ensureWarehouseSchema(config.dbPath);
  const currentPlanPk = ensureCurrentPlan(config.dbPath);
  ensureCurrentPlanMemberships(config.dbPath, currentPlanPk);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");

      const acknowledgeMatch = url.pathname.match(/^\/alerts\/(\d+)\/acknowledge$/);
      if (acknowledgeMatch) {
        if (req.method !== "PUT") {
          return sendError(res, 405, "method_not_allowed", "Only PUT is supported for alert acknowledge.");
        }

        const alertId = Number(acknowledgeMatch[1]);
        const alert = getAlertById(config.dbPath, alertId);
        if (!alert) {
          return sendError(res, 404, "not_found", `Alert not found: ${alertId}`);
        }

        acknowledgeAlert(config.dbPath, alertId, new Date().toISOString());
        return sendJson(res, 200, {
          data: toAlertDto(getAlertById(config.dbPath, alertId)),
        });
      }

      const suppressMatch = url.pathname.match(/^\/alerts\/(\d+)\/suppress$/);
      if (suppressMatch) {
        if (req.method !== "PUT") {
          return sendError(res, 405, "method_not_allowed", "Only PUT is supported for alert suppress.");
        }

        const alertId = Number(suppressMatch[1]);
        const alert = getAlertById(config.dbPath, alertId);
        if (!alert) {
          return sendError(res, 404, "not_found", `Alert not found: ${alertId}`);
        }

        suppressAlert(config.dbPath, alertId, new Date().toISOString());
        return sendJson(res, 200, {
          data: toAlertDto(getAlertById(config.dbPath, alertId)),
        });
      }

      if (url.pathname === "/settings/telegram-alerts") {
        if (req.method === "GET") {
          const setting = getJsonSetting(config.dbPath, TELEGRAM_ALERT_SETTINGS_KEY);
          return sendJson(res, 200, {
            data: toTelegramAlertSettingsDto(setting),
          });
        }

        if (req.method === "PUT") {
          const payload = await readJsonBody(req);
          const current = getJsonSetting(config.dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
          const next = buildTelegramAlertSettings(current, payload);
          const updatedAt = new Date().toISOString();
          upsertJsonSetting(config.dbPath, TELEGRAM_ALERT_SETTINGS_KEY, next, updatedAt);

          return sendJson(res, 200, {
            data: toTelegramAlertSettingsDto({
              value: next,
              updated_at: updatedAt,
            }),
          });
        }

        return sendError(res, 405, "method_not_allowed", "Only GET and PUT are supported for telegram alert settings.");
      }

      if (url.pathname === "/settings/alert-rules") {
        if (req.method !== "GET") {
          return sendError(res, 405, "method_not_allowed", "Only GET is supported for alert rules list.");
        }

        const rules = listBotAlertRules(config.dbPath).map(toBotAlertRuleDto);
        return sendJson(res, 200, {
          data: rules,
          meta: {
            count: rules.length,
          },
        });
      }

      const totalPnlRuleMatch = url.pathname.match(/^\/settings\/alert-rules\/([^/]+)\/total-pnl$/);
      if (totalPnlRuleMatch) {
        if (req.method !== "PUT") {
          return sendError(res, 405, "method_not_allowed", "Only PUT is supported for bot alert rule updates.");
        }

        const botId = decodeURIComponent(totalPnlRuleMatch[1]);
        const bot = getBotById(config.dbPath, botId);
        if (!bot) {
          return sendError(res, 404, "not_found", `Bot not found: ${botId}`);
        }

        const payload = await readJsonBody(req);
        const rule = buildTotalPnlRuleInput(bot, payload);
        const updatedAt = new Date().toISOString();
        upsertTotalPnlRule(config.dbPath, { ...rule, bot_pk: bot.bot_pk }, updatedAt);

        const updatedRule = listBotAlertRules(config.dbPath)
          .filter((row) => Number(row.bot_pk) === Number(bot.bot_pk))
          .map(toBotAlertRuleDto)[0];

        return sendJson(res, 200, {
          data: updatedRule,
        });
      }

      if (url.pathname === "/plans/current") {
        if (req.method === "GET") {
          const plan = getCurrentPlan(config.dbPath);
          ensureCurrentPlanMemberships(config.dbPath, plan.plan_pk);
          const participants = listCurrentPlanBots(config.dbPath, plan.plan_pk);
          const snapshots = listCurrentPlanSnapshots(config.dbPath, plan.plan_pk);
          return sendJson(res, 200, {
            data: toPlanDto(plan, participants, snapshots),
          });
        }

        if (req.method === "PUT") {
          const payload = await readJsonBody(req);
          const updatedAt = new Date().toISOString();
          upsertCurrentPlan(
            config.dbPath,
            {
              title: normalizePlanTitle(payload.title),
              target_daily_pnl_usd: parseNullableNumber(payload.targetDailyPnlUsd),
              status: normalizePlanStatus(payload.status),
              notes: normalizeOptionalText(payload.notes),
            },
            updatedAt
          );

          const plan = getCurrentPlan(config.dbPath);
          ensureCurrentPlanMemberships(config.dbPath, plan.plan_pk);
          const participants = listCurrentPlanBots(config.dbPath, plan.plan_pk);
          const snapshots = listCurrentPlanSnapshots(config.dbPath, plan.plan_pk);
          return sendJson(res, 200, {
            data: toPlanDto(plan, participants, snapshots),
          });
        }

        return sendError(res, 405, "method_not_allowed", "Only GET and PUT are supported for current plan.");
      }

      const planBotMatch = url.pathname.match(/^\/plans\/current\/bots\/([^/]+)$/);
      if (planBotMatch) {
        if (req.method !== "PUT") {
          return sendError(res, 405, "method_not_allowed", "Only PUT is supported for current plan bot updates.");
        }

        const botId = decodeURIComponent(planBotMatch[1]);
        const bot = getBotById(config.dbPath, botId);
        if (!bot) {
          return sendError(res, 404, "not_found", `Bot not found: ${botId}`);
        }

        const payload = await readJsonBody(req);
        const plan = getCurrentPlan(config.dbPath);
        const updatedAt = new Date().toISOString();
        upsertPlanBotMembership(
          config.dbPath,
          plan.plan_pk,
          bot.bot_pk,
          {
            is_included: Boolean(payload.isIncluded),
            weight: parseNullableNumber(payload.weight),
          },
          updatedAt
        );

        const refreshedPlan = getCurrentPlan(config.dbPath);
        const participants = listCurrentPlanBots(config.dbPath, refreshedPlan.plan_pk);
        const snapshots = listCurrentPlanSnapshots(config.dbPath, refreshedPlan.plan_pk);
        return sendJson(res, 200, {
          data: toPlanDto(refreshedPlan, participants, snapshots),
        });
      }

      if (req.method !== "GET") {
        return sendError(res, 405, "method_not_allowed", "Only GET endpoints are supported.");
      }

      if (url.pathname === "/bots") {
        const bots = listBots(config.dbPath).map(toBotListItemDto);
        return sendJson(res, 200, {
          data: bots,
          meta: {
            count: bots.length,
          },
        });
      }

      if (url.pathname === "/health") {
        const summary = getHealthSummary(config.dbPath) || {};
        return sendJson(res, 200, {
          data: toHealthDto(summary, config.dbPath, startedAt),
        });
      }

      if (url.pathname === "/metrics") {
        const metrics = getApiMetrics(config.dbPath) || {};
        return sendJson(res, 200, {
          data: toMetricsDto(metrics, config.dbPath, startedAt),
        });
      }

      if (url.pathname === "/service/status") {
        const serviceStatus = getServiceStatus(config.dbPath, SNAPSHOT_SERVICE_NAME);
        return sendJson(res, 200, {
          data: toServiceStatusDto(serviceStatus, SNAPSHOT_SERVICE_NAME),
        });
      }

      if (url.pathname === "/dashboard/summary") {
        const summary = getDashboardSummary(config.dbPath) || {};
        const statusBreakdown = getDashboardStatusBreakdown(config.dbPath);
        const botTypeBreakdown = getDashboardBotTypeBreakdown(config.dbPath);
        return sendJson(res, 200, {
          data: toDashboardSummaryDto(summary, statusBreakdown, botTypeBreakdown),
        });
      }

      if (url.pathname === "/alerts") {
        const limit = parseLimit(url.searchParams.get("limit"), 50, 200);
        const alerts = listRecentAlerts(config.dbPath, limit).map(toAlertDto);
        return sendJson(res, 200, {
          data: alerts,
          meta: {
            count: alerts.length,
            limit,
          },
        });
      }

      const botMatch = url.pathname.match(/^\/bots\/([^/]+)$/);
      if (botMatch) {
        const botId = decodeURIComponent(botMatch[1]);
        const bot = getBotById(config.dbPath, botId);
        if (!bot) {
          return sendError(res, 404, "not_found", `Bot not found: ${botId}`);
        }

        const latestSnapshot = getLatestBotSnapshot(config.dbPath, bot.bot_pk);
        return sendJson(res, 200, {
          data: toBotDetailsDto(bot, latestSnapshot),
        });
      }

      const snapshotsMatch = url.pathname.match(/^\/bots\/([^/]+)\/snapshots$/);
      if (snapshotsMatch) {
        const botId = decodeURIComponent(snapshotsMatch[1]);
        const bot = getBotById(config.dbPath, botId);
        if (!bot) {
          return sendError(res, 404, "not_found", `Bot not found: ${botId}`);
        }

        const limit = parseLimit(url.searchParams.get("limit"), 100, 500);
        const snapshots = getBotSnapshots(config.dbPath, botId, limit).map(toBotSnapshotDto);
        return sendJson(res, 200, {
          data: snapshots,
          meta: {
            botId: bot.bybit_bot_id || `bot:${bot.bot_pk}`,
            count: snapshots.length,
            limit,
          },
        });
      }

      return sendError(res, 404, "not_found", `Route not found: ${url.pathname}`);
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error) {
        return sendError(
          res,
          error.statusCode,
          error.code || "bad_request",
          error.message || "Request failed."
        );
      }

      return sendError(
        res,
        500,
        "internal_error",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return server;
}

function parseLimit(rawValue, defaultValue, maxValue) {
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function sendError(res, statusCode, code, message) {
  return sendJson(res, statusCode, {
    error: {
      code,
      message,
    },
  });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw createHttpError(400, "bad_request", "Invalid JSON body.");
  }
}

function buildTelegramAlertSettings(current, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "bad_request", "Telegram alert settings payload must be an object.");
  }

  const minSeverity = normalizeSeverity(payload.minSeverity ?? current.minSeverity);
  const next = {
    enabled: Boolean(payload.enabled),
    botToken:
      typeof payload.botToken === "string"
        ? payload.botToken.trim() || current.botToken || ""
        : current.botToken || "",
    chatId:
      typeof payload.chatId === "string"
        ? payload.chatId.trim()
        : typeof current.chatId === "string"
          ? current.chatId
          : "",
    minSeverity,
    sendResolved: Boolean(payload.sendResolved),
    tradeActivityNotificationsEnabled: Boolean(payload.tradeActivityNotificationsEnabled),
    tradeActivityMutedBotIds: normalizeMutedBotIds(payload.tradeActivityMutedBotIds ?? current.tradeActivityMutedBotIds),
  };

  if (next.enabled && (!next.botToken || !next.chatId)) {
    throw createHttpError(400, "validation_error", "Bot token and chat id are required when telegram alerts are enabled.");
  }

  return next;
}

function buildTotalPnlRuleInput(bot, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "bad_request", "Alert rule payload must be an object.");
  }

  const thresholdValue =
    payload.thresholdValue === null || payload.thresholdValue === ""
      ? null
      : Number(payload.thresholdValue);

  if (payload.enabled && !Number.isFinite(thresholdValue)) {
    throw createHttpError(400, "validation_error", "Threshold value is required when the rule is enabled.");
  }

  const comparisonOperator = normalizeComparisonOperator(payload.comparisonOperator);
  const severity = normalizeSeverity(payload.severity);

  return {
    is_enabled: Boolean(payload.enabled),
    comparison_operator: comparisonOperator,
    threshold_value: thresholdValue,
    severity,
    title:
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : `PnL ${comparisonOperator === "gte" ? ">=" : "<="} ${thresholdValue} · ${bot.symbol || bot.bybit_bot_id}`,
  };
}

function normalizeSeverity(value) {
  return ["info", "warning", "critical"].includes(value) ? value : "warning";
}

function normalizeMutedBotIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function normalizeComparisonOperator(value) {
  return value === "gte" ? "gte" : "lte";
}

function normalizePlanStatus(value) {
  return ["active", "paused", "archived"].includes(value) ? value : null;
}

function normalizePlanTitle(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().slice(0, 1000);
}

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = {
  createApiServer,
};
