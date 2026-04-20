import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { dto, rules, warehouse } from "../shared/legacy-bridge";
import { apiStore } from "../shared/legacy-bridge";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tradeNotifications = require("../../../legacy/src/services/telegramTradeNotifications.js");

const TELEGRAM_ALERT_SETTINGS_KEY = "telegram_alert_settings";

@Injectable()
export class SettingsService {
  async getTelegramSettings() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const setting = warehouse.getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY);
    return dto.toTelegramAlertSettingsDto(setting);
  }

  async updateTelegramSettings(payload: unknown) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const current = warehouse.getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
    const next = buildTelegramAlertSettings(current, payload);
    const updatedAt = new Date().toISOString();
    warehouse.upsertJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY, next, updatedAt);
    return dto.toTelegramAlertSettingsDto({
      value: next,
      updated_at: updatedAt,
    });
  }

  async getAlertRules() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    return rules.listBotAlertRules(dbPath).map(dto.toBotAlertRuleDto);
  }

  async updateTotalPnlRule(botId: string, payload: unknown) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const input = buildTotalPnlRuleInput(bot, payload);
    const updatedAt = new Date().toISOString();
    rules.upsertTotalPnlRule(dbPath, { ...input, bot_pk: bot.bot_pk }, updatedAt);
    const updatedRule = rules
      .listBotAlertRules(dbPath)
      .filter((row: Record<string, unknown>) => Number(row.bot_pk) === Number(bot.bot_pk))
      .map(dto.toBotAlertRuleDto)[0];

    return updatedRule;
  }

  async updateGridProfitCaptureRule(botId: string, payload: unknown) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const input = buildGridProfitCaptureRuleInput(bot, payload);
    const updatedAt = new Date().toISOString();
    rules.upsertGridProfitCaptureReadyRule(dbPath, { ...input, bot_pk: bot.bot_pk }, updatedAt);
    const updatedRule = rules
      .listBotAlertRules(dbPath)
      .filter((row: Record<string, unknown>) => Number(row.bot_pk) === Number(bot.bot_pk))
      .map(dto.toBotAlertRuleDto)[0];

    return updatedRule;
  }

  async sendTestTradeNotification(botId: string) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const latestSnapshot = apiStore.getLatestBotSnapshot(dbPath, bot.bot_pk);
    if (!latestSnapshot) {
      throw new BadRequestException("No snapshot available for this bot.");
    }

    const sampleProfitPerTrade = estimateSampleProfitPerTrade(latestSnapshot);
    const sampleFundingDelta = -0.01;
    const sampleRealizedDelta = Number((sampleProfitPerTrade + sampleFundingDelta).toFixed(4));
    const sent = await tradeNotifications.notifyTelegramAboutTradeActivity(
      dbPath,
      {
        bot_pk: bot.bot_pk,
        bybit_bot_id: bot.bybit_bot_id,
        symbol: latestSnapshot.symbol || bot.symbol || bot.bybit_bot_id,
        leverage: latestSnapshot.leverage ?? null,
      },
      latestSnapshot,
      {
        activityCountDelta: 1,
        gridProfitDelta: sampleProfitPerTrade,
        fundingFeesDelta: sampleFundingDelta,
        realizedPnlDelta: sampleRealizedDelta,
        currentSnapshotTime: new Date().toISOString(),
      },
      null,
      { ignoreMute: true }
    );

    if (!sent) {
      throw new BadRequestException("Telegram trade notifications are disabled or not configured.");
    }

    return {
      sent: true,
      botId,
    };
  }

  async sendTestGridProfitCaptureNotification(botId: string) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const latestSnapshot = apiStore.getLatestBotSnapshot(dbPath, bot.bot_pk);
    if (!latestSnapshot) {
      throw new BadRequestException("No snapshot available for this bot.");
    }

    const settings = warehouse.getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
    const enabled = Boolean(settings.enabled);
    const botToken = typeof settings.botToken === "string" ? settings.botToken.trim() : "";
    const chatId = typeof settings.chatId === "string" ? settings.chatId.trim() : "";

    if (!enabled || !botToken || !chatId) {
      throw new BadRequestException("Telegram alerts are disabled or not configured.");
    }

    const symbol = latestSnapshot.symbol || bot.symbol || bot.bybit_bot_id;
    const leverage = toNullableNumber(latestSnapshot.leverage);
    const gridProfit = toNullableNumber(latestSnapshot.grid_profit);
    const totalPnl = toNullableNumber(latestSnapshot.total_pnl);
    const botLabel = [symbol, leverage !== null ? `x${Math.round(leverage)}` : ""].filter(Boolean).join(" ");

    const lines = [
      "🔔 Тест сигнала: можно забрать всю grid прибыль",
      `🤖 ${botLabel}`,
      "По этому боту текущая позиция уже не съедает накопленную grid-прибыль.",
      "",
      `📈 Grid profit: ${formatSignedUsd(gridProfit)}`,
      `🧾 Total pnl: ${formatSignedUsd(totalPnl)}`,
      "",
      `💵 Прибыль сейчас: ${formatSignedUsd(totalPnl)}`,
      `🕒 ${new Date().toLocaleString("ru-RU")}`,
    ];

    await sendTelegramMessage(botToken, chatId, lines.join("\n"));

    return {
      sent: true,
      botId,
    };
  }
}

function buildTelegramAlertSettings(current: Record<string, unknown>, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Telegram alert settings payload must be an object.");
  }

  const body = payload as Record<string, unknown>;
  const minSeverity = normalizeSeverity((body.minSeverity ?? current.minSeverity) as string | undefined);
  const next = {
    enabled: Boolean(body.enabled),
    botToken:
      typeof body.botToken === "string"
        ? body.botToken.trim() || String(current.botToken || "")
        : String(current.botToken || ""),
    chatId:
      typeof body.chatId === "string"
        ? body.chatId.trim()
        : typeof current.chatId === "string"
          ? current.chatId
          : "",
    minSeverity,
    sendResolved: Boolean(body.sendResolved),
    tradeActivityNotificationsEnabled: Boolean(body.tradeActivityNotificationsEnabled),
    tradeActivityMutedBotIds: normalizeMutedBotIds(body.tradeActivityMutedBotIds ?? current.tradeActivityMutedBotIds),
  };

  if (next.enabled && (!next.botToken || !next.chatId)) {
    throw new BadRequestException("Bot token and chat id are required when telegram alerts are enabled.");
  }

  return next;
}

function buildTotalPnlRuleInput(bot: Record<string, unknown>, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Alert rule payload must be an object.");
  }

  const body = payload as Record<string, unknown>;
  const thresholdValue =
    body.thresholdValue === null || body.thresholdValue === ""
      ? null
      : Number(body.thresholdValue);

  if (body.enabled && !Number.isFinite(thresholdValue)) {
    throw new BadRequestException("Threshold value is required when the rule is enabled.");
  }

  const comparisonOperator = body.comparisonOperator === "gte" ? "gte" : "lte";
  const severity = normalizeSeverity(typeof body.severity === "string" ? body.severity : undefined);

  return {
    is_enabled: Boolean(body.enabled),
    comparison_operator: comparisonOperator,
    threshold_value: thresholdValue,
    severity,
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `PnL ${comparisonOperator === "gte" ? ">=" : "<="} ${thresholdValue} · ${bot.symbol || bot.bybit_bot_id}`,
  };
}

function buildGridProfitCaptureRuleInput(bot: Record<string, unknown>, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Alert rule payload must be an object.");
  }

  const body = payload as Record<string, unknown>;
  const severity = normalizeSeverity(typeof body.severity === "string" ? body.severity : undefined);

  return {
    is_enabled: Boolean(body.enabled),
    severity,
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `Можно забрать всю grid прибыль · ${bot.symbol || bot.bybit_bot_id}`,
  };
}

function normalizeSeverity(value?: string) {
  return ["info", "warning", "critical"].includes(String(value)) ? String(value) : "warning";
}

function normalizeMutedBotIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function estimateSampleProfitPerTrade(snapshot: Record<string, unknown>) {
  const gridProfit = toNullableNumber(snapshot.grid_profit);
  const activityCount = toNullableNumber(snapshot.activity_count);

  if (gridProfit !== null && activityCount !== null && activityCount > 0) {
    return Number(Math.abs(gridProfit / activityCount).toFixed(4));
  }

  if (gridProfit !== null) {
    return Number(Math.max(Math.abs(gridProfit), 0.05).toFixed(4));
  }

  return 0.1;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSignedUsd(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "н/д";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}$`;
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new BadRequestException(`Telegram send failed status=${response.status} body=${body.slice(0, 200)}`);
  }
}
