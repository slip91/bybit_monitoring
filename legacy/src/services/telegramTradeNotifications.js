const TELEGRAM_ALERT_SETTINGS_KEY = "telegram_alert_settings";
const DELTA_EPSILON = 1e-9;

const apiStore = require("../db/apiStore");
const { queryJson, sqlNumber } = require("../db/sqlite");
const { getJsonSetting } = require("../db/warehouse");

function getPreviousSnapshotForBot(dbPath, botPk) {
  const rows = queryJson(
    dbPath,
    `SELECT
       snapshot_id,
     snapshot_time,
     status,
     activity_count,
     grid_profit,
     funding_fees,
     realized_pnl,
     total_pnl
     FROM bot_snapshots
     WHERE bot_pk = ${sqlNumber(botPk)}
     ORDER BY snapshot_time DESC, snapshot_id DESC
     LIMIT 1`
  );

  return rows[0] || null;
}

function detectBotClosure(previousSnapshot, currentSnapshot, rawDetail = null) {
  if (!currentSnapshot) {
    return null;
  }

  const wasCompleted = isCompletedStatus(previousSnapshot?.status);
  const isCompleted = isCompletedStatus(currentSnapshot.status);
  if (!isCompleted || wasCompleted) {
    return null;
  }

  return {
    currentSnapshotTime: currentSnapshot.snapshot_time ?? null,
    closeProfit: numberOrNull(currentSnapshot.total_pnl) ?? numberOrNull(currentSnapshot.realized_pnl),
    realizedPnl: numberOrNull(currentSnapshot.realized_pnl),
    closeReason: inferCloseReason(rawDetail, currentSnapshot),
  };
}

function detectTradeActivity(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot || !currentSnapshot) {
    return null;
  }

  const activityCountDelta = computePositiveDelta(previousSnapshot.activity_count, currentSnapshot.activity_count);
  const gridProfitDelta = computePositiveDelta(previousSnapshot.grid_profit, currentSnapshot.grid_profit);
  const fundingFeesDelta = computeDelta(previousSnapshot.funding_fees, currentSnapshot.funding_fees);
  const realizedPnlDelta = computeDelta(previousSnapshot.realized_pnl, currentSnapshot.realized_pnl);

  const hasTradeSignal = activityCountDelta > 0 || gridProfitDelta > DELTA_EPSILON;
  if (!hasTradeSignal) {
    return null;
  }

  return {
    previousSnapshotTime: previousSnapshot.snapshot_time ?? null,
    currentSnapshotTime: currentSnapshot.snapshot_time ?? null,
    activityCountDelta: activityCountDelta > 0 ? activityCountDelta : null,
    gridProfitDelta: gridProfitDelta > DELTA_EPSILON ? roundMetric(gridProfitDelta) : null,
    fundingFeesDelta: Math.abs(fundingFeesDelta) > DELTA_EPSILON ? roundMetric(fundingFeesDelta) : null,
    realizedPnlDelta: Math.abs(realizedPnlDelta) > DELTA_EPSILON ? roundMetric(realizedPnlDelta) : null,
  };
}

async function notifyTelegramAboutTradeActivity(dbPath, bot, snapshot, event, logger = null, options = {}) {
  const settings = getTelegramTradeNotificationSettings(dbPath);
  if (!settings) {
    return false;
  }
  if (!options.ignoreMute && settings.mutedBotIds.includes(String(bot.bybit_bot_id || bot.bot_pk))) {
    return false;
  }

  const currentDayProfit = computeCurrentDayProfit(dbPath, bot, snapshot);
  const text = buildTradeActivityMessage(bot, { ...snapshot, current_day_profit: currentDayProfit }, event);
  return sendTelegramMessage(settings, text, logger, `trade notification failed bot_id=${bot.bybit_bot_id}`);
}

async function notifyTelegramAboutBotClosure(dbPath, bot, snapshot, event, logger = null, options = {}) {
  const settings = getTelegramTradeNotificationSettings(dbPath);
  if (!settings) {
    return false;
  }
  if (!options.ignoreMute && settings.mutedBotIds.includes(String(bot.bybit_bot_id || bot.bot_pk))) {
    return false;
  }

  const text = buildBotClosureMessage(bot, snapshot, event);
  return sendTelegramMessage(settings, text, logger, `telegram close notification failed bot_id=${bot.bybit_bot_id}`);
}

async function sendTelegramMessage(settings, text, logger, errorPrefix) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`telegram send failed status=${response.status} body=${body.slice(0, 200)}`);
    }

    return true;
  } catch (error) {
    if (logger && typeof logger.warn === "function") {
      logger.warn(`${errorPrefix} error=${toMessage(error)}`);
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function getTelegramTradeNotificationSettings(dbPath) {
  const value = getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
  const enabled = Boolean(value.enabled);
  const tradeActivityNotificationsEnabled = Boolean(value.tradeActivityNotificationsEnabled);
  const botToken = typeof value.botToken === "string" ? value.botToken.trim() : "";
  const chatId = typeof value.chatId === "string" ? value.chatId.trim() : "";
  const mutedBotIds = Array.isArray(value.tradeActivityMutedBotIds)
    ? value.tradeActivityMutedBotIds.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];

  if (!enabled || !tradeActivityNotificationsEnabled || !botToken || !chatId) {
    return null;
  }

  return {
    botToken,
    chatId,
    mutedBotIds,
  };
}

function buildTradeActivityMessage(bot, snapshot, event) {
  const lines = [];
  const botLabel = [bot.symbol || bot.bybit_bot_id || `bot:${bot.bot_pk}`, bot.leverage ? `x${bot.leverage}` : ""]
    .filter(Boolean)
    .join(" ");
  const headlineProfit = numberOrNull(event.gridProfitDelta) ?? numberOrNull(event.realizedPnlDelta) ?? computeProfitPerTrade(event) ?? 0;
  const activityCountDelta = numberOrNull(event.activityCountDelta);
  const profitPerTrade = computeProfitPerTrade(event);
  const profitPerDay =
    numberOrNull(snapshot.current_day_profit) ??
    numberOrNull(snapshot.currentDayProfit);

  if (activityCountDelta !== null && activityCountDelta > 0) {
    lines.push(`🔔 Сделок +${activityCountDelta}, итог ${formatMarkedSignedUsd(headlineProfit)}`);
  } else {
    lines.push(`🔔 Изменение ${formatMarkedSignedUsd(headlineProfit)}`);
  }
  lines.push(`🤖 ${botLabel}`);
  if (profitPerDay !== null) {
    lines.push(`📆 Прибыль за день: ${formatSignedUsd(profitPerDay)}`);
  }
  if (event.gridProfitDelta !== null) {
    lines.push(`📈 Grid Δ: ${formatMarkedSignedUsd(event.gridProfitDelta)}`);
  }
  if (profitPerTrade !== null && event.gridProfitDelta !== null) {
    lines.push(`✨ Прибыль за сделку: ${formatSigned(profitPerTrade)}`);
  }
  if (event.activityCountDelta) {
    lines.push(`🎯 Сделок: +${event.activityCountDelta}`);
  }
  if (snapshot.grid_profit !== null && snapshot.grid_profit !== undefined) {
    lines.push(`📊 Текущий grid: ${formatSigned(snapshot.grid_profit)}`);
  }
  lines.push("");
  if (snapshot.equity !== null && snapshot.equity !== undefined) {
    lines.push(`💼 Баланс: ${formatMoney(snapshot.equity)}`);
  }
  if (snapshot.total_pnl !== null && snapshot.total_pnl !== undefined) {
    lines.push(`🧾 Текущий total: ${formatSigned(snapshot.total_pnl)}`);
  }
  if (event.realizedPnlDelta !== null) {
    lines.push(`🧮 Realized Δ: ${formatMarkedSignedUsd(event.realizedPnlDelta)}`);
  }
  if (event.fundingFeesDelta !== null) {
    lines.push(`💸 Funding Δ: ${formatMarkedSignedUsd(event.fundingFeesDelta)}`);
  }

  if (event.currentSnapshotTime) {
    lines.push("");
    lines.push(`🕒 ${new Date(event.currentSnapshotTime).toLocaleString("ru-RU")}`);
  }

  return lines.join("\n");
}

function buildBotClosureMessage(bot, snapshot, event) {
  const lines = [];
  const botLabel = [bot.symbol || bot.bybit_bot_id || `bot:${bot.bot_pk}`, bot.leverage ? `x${bot.leverage}` : ""]
    .filter(Boolean)
    .join(" ");
  const closeProfit = numberOrNull(event.closeProfit) ?? 0;

  lines.push(`🔒 Бот закрыт ${formatSignedUsd(closeProfit)}`);
  lines.push(`🤖 ${botLabel}`);

  if (event.closeReason) {
    lines.push(`🏷️ Причина: ${event.closeReason}`);
  }
  if (snapshot.total_pnl !== null && snapshot.total_pnl !== undefined) {
    lines.push(`🧾 Итоговый total: ${formatSigned(snapshot.total_pnl)}`);
  }

  lines.push("");
  if (snapshot.equity !== null && snapshot.equity !== undefined) {
    lines.push(`💼 Баланс на закрытии: ${formatMoney(snapshot.equity)}`);
  }
  if (event.realizedPnl !== null) {
    lines.push(`💵 Realized: ${formatSigned(event.realizedPnl)}`);
  }

  if (event.currentSnapshotTime) {
    lines.push("");
    lines.push(`🕒 ${new Date(event.currentSnapshotTime).toLocaleString("ru-RU")}`);
  }

  return lines.join("\n");
}

function computePositiveDelta(previousValue, currentValue) {
  const previous = numberOrNull(previousValue);
  const current = numberOrNull(currentValue);

  if (previous === null || current === null) {
    return 0;
  }

  return Math.max(0, current - previous);
}

function computeDelta(previousValue, currentValue) {
  const previous = numberOrNull(previousValue);
  const current = numberOrNull(currentValue);

  if (previous === null || current === null) {
    return 0;
  }

  return current - previous;
}

function computeProfitPerTrade(event) {
  const activityCountDelta = numberOrNull(event.activityCountDelta);
  if (activityCountDelta === null || activityCountDelta <= 0) {
    return null;
  }

  const gridProfitDelta = numberOrNull(event.gridProfitDelta);
  if (gridProfitDelta !== null) {
    return roundMetric(gridProfitDelta / activityCountDelta);
  }

  const realizedPnlDelta = numberOrNull(event.realizedPnlDelta);
  if (realizedPnlDelta !== null) {
    return roundMetric(realizedPnlDelta / activityCountDelta);
  }

  return null;
}

function computeCurrentDayProfit(dbPath, bot, snapshot) {
  const botPk = numberOrNull(bot?.bot_pk);
  if (botPk === null) {
    return null;
  }

  const dayStartMs = startOfLocalDayMs(Date.now());
  const dayStartIso = new Date(dayStartMs).toISOString();
  const anchor = apiStore.listBotGridProfitAnchors(dbPath, [botPk], dayStartIso)[0] || null;
  const botRow = apiStore.getBotById(dbPath, String(bot.bybit_bot_id || botPk)) || null;
  const startedAtMs =
    parseTimestampMs(snapshot?.create_time) ??
    parseTimestampMs(bot?.create_time) ??
    parseTimestampMs(botRow?.create_time) ??
    parseTimestampMs(bot?.confirmed_at) ??
    parseTimestampMs(botRow?.confirmed_at) ??
    parseTimestampMs(bot?.first_seen_at) ??
    parseTimestampMs(botRow?.first_seen_at) ??
    null;

  return computeGridProfitDeltaSinceWindowStart({
    baselineGridProfit: numberOrNull(anchor?.baseline_grid_profit),
    firstWindowGridProfit: numberOrNull(anchor?.first_window_grid_profit),
    latestGridProfit: numberOrNull(anchor?.latest_grid_profit) ?? numberOrNull(snapshot?.grid_profit),
    startedAtMs,
    windowStartMs: dayStartMs,
  });
}

function startOfLocalDayMs(referenceMs) {
  const date = new Date(referenceMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function computeGridProfitDeltaSinceWindowStart(params) {
  const baselineGridProfit = numberOrNull(params?.baselineGridProfit);
  const latestGridProfit = numberOrNull(params?.latestGridProfit);
  const firstWindowGridProfit = numberOrNull(params?.firstWindowGridProfit);
  const startedAtMs = numberOrNull(params?.startedAtMs);
  const windowStartMs = numberOrNull(params?.windowStartMs);

  if (latestGridProfit === null || windowStartMs === null) {
    return null;
  }

  if (baselineGridProfit !== null) {
    return roundMetric(latestGridProfit - baselineGridProfit);
  }

  if (startedAtMs !== null && startedAtMs >= windowStartMs) {
    return roundMetric(latestGridProfit);
  }

  if (firstWindowGridProfit !== null) {
    return roundMetric(latestGridProfit - firstWindowGridProfit);
  }

  return null;
}

function parseTimestampMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function inferCloseReason(rawDetail, currentSnapshot) {
  const takeProfitPrice = numberOrNull(rawDetail?.take_profit_price);
  const stopLossPrice = numberOrNull(rawDetail?.stop_loss_price);
  const lastPrice = numberOrNull(rawDetail?.last_price) ?? numberOrNull(rawDetail?.mark_price);
  const totalPnl = numberOrNull(currentSnapshot?.total_pnl);

  if (takeProfitPrice !== null && lastPrice !== null && isNearLevel(lastPrice, takeProfitPrice)) {
    return "take profit";
  }

  if (stopLossPrice !== null && lastPrice !== null && isNearLevel(lastPrice, stopLossPrice)) {
    return "stop loss";
  }

  if (takeProfitPrice !== null && totalPnl !== null && totalPnl > 0) {
    return "take profit / иное";
  }

  if (stopLossPrice !== null && totalPnl !== null && totalPnl < 0) {
    return "stop loss / иное";
  }

  return "ручное / иное закрытие";
}

function isCompletedStatus(value) {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  return normalized.includes("COMPLETED");
}

function isNearLevel(price, level) {
  if (!Number.isFinite(price) || !Number.isFinite(level) || level === 0) {
    return false;
  }

  return Math.abs(price - level) / Math.abs(level) <= 0.003;
}

function formatMoney(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "n/a";
  }

  return `$${roundMetric(numeric).toFixed(2)}`;
}

function formatSignedUsd(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "n/a";
  }

  return `${numeric >= 0 ? "+" : ""}${roundMetric(numeric).toFixed(2)}$`;
}

function formatMarkedSignedUsd(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "n/a";
  }

  const marker = numeric > 0 ? "🟢" : numeric < 0 ? "🔴" : "⚪";
  return `${marker} ${formatSignedUsd(numeric)}`;
}

function formatSigned(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return "n/a";
  }

  return `${numeric >= 0 ? "+" : ""}${roundMetric(numeric).toFixed(2)}`;
}

function roundMetric(value) {
  return Number(value.toFixed(4));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

module.exports = {
  buildBotClosureMessage,
  buildTradeActivityMessage,
  computeCurrentDayProfit,
  detectBotClosure,
  detectTradeActivity,
  getPreviousSnapshotForBot,
  getTelegramTradeNotificationSettings,
  notifyTelegramAboutBotClosure,
  notifyTelegramAboutTradeActivity,
};
