import { apiStore, warehouse } from "../shared/legacy-bridge";
import { computeGridProfitDeltaSinceWindowStart, parseTimestampMs, startOfLocalDayMs } from "../shared/current-day-profit";

const TELEGRAM_ALERT_SETTINGS_KEY = "telegram_alert_settings";
const TELEGRAM_COMMAND_STATE_KEY = "telegram_bot_command_state";

export async function pollTelegramCommands(dbPath: string, logger?: TelegramLogger) {
  warehouse.ensureWarehouseSchema(dbPath);
  const settings = getTelegramSettings(dbPath);
  if (!settings) {
    return { processed: 0 };
  }

  const state = warehouse.getJsonSetting(dbPath, TELEGRAM_COMMAND_STATE_KEY)?.value || {};
  const offset = Number.isInteger(Number(state.lastUpdateId)) ? Number(state.lastUpdateId) + 1 : undefined;
  const updates = await fetchTelegramUpdates(settings.botToken, offset);
  if (updates.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;
  let lastUpdateId = offset ? offset - 1 : 0;

  for (const update of updates) {
    lastUpdateId = Math.max(lastUpdateId, Number(update.update_id) || 0);
    const message = update.message;
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    const chatId = message?.chat?.id === undefined || message?.chat?.id === null ? "" : String(message.chat.id);

    if (!text || chatId !== settings.chatId) {
      continue;
    }

    const command = normalizeCommand(text);
    if (!command) {
      continue;
    }

    let responseText: string | null = null;
    if (command === "/status" || command === "/bots") {
      responseText = buildStatusMessage(dbPath);
    } else if (command === "/help" || command === "/start") {
      responseText = buildHelpMessage();
    }

    if (!responseText) {
      continue;
    }

    await sendTelegramMessage(settings.botToken, settings.chatId, responseText);
    processed += 1;
  }

  warehouse.upsertJsonSetting(
    dbPath,
    TELEGRAM_COMMAND_STATE_KEY,
    { lastUpdateId },
    new Date().toISOString(),
  );

  if (processed > 0) {
    logger?.log?.(`telegram commands processed=${processed}`);
  }

  return { processed };
}

export function buildStatusMessage(dbPath: string) {
  const rows = apiStore
    .listBots(dbPath)
    .filter((row: Record<string, unknown>) => Number(row.is_active) === 1);

  if (rows.length === 0) {
    return "🟢 Активных ботов сейчас нет.";
  }

  const dayStartIso = new Date(startOfLocalDayMs(Date.now())).toISOString();
  const anchors = apiStore.listBotGridProfitAnchors(
    dbPath,
    rows.map((row: Record<string, unknown>) => row.bot_pk),
    dayStartIso,
  );
  const anchorByBotPk = new Map(
    anchors.map((row: Record<string, unknown>) => [
      Number(row.bot_pk),
      {
        baselineGridProfit: toNullableNumber(row.baseline_grid_profit),
        firstWindowGridProfit: toNullableNumber(row.first_window_grid_profit),
        latestGridProfit: toNullableNumber(row.latest_grid_profit),
      },
    ]),
  );
  const dayStartMs = startOfLocalDayMs(Date.now());

  const lines = [`🟢 Активные боты: ${rows.length}`, ""];

  rows.forEach((row: Record<string, unknown>, index: number) => {
    const botPk = Number(row.bot_pk);
    const symbol = asString(row.symbol) || asString(row.bybit_bot_id) || `bot:${botPk}`;
    const leverage = toNullableNumber(row.leverage);
    const totalPnl = toNullableNumber(row.total_pnl);
    const equity = toNullableNumber(row.equity);
    const gridProfit = toNullableNumber(row.grid_profit);
    const anchor = anchorByBotPk.get(botPk) as { baselineGridProfit: number | null; firstWindowGridProfit: number | null; latestGridProfit: number | null } | undefined;
    const startedAtMs =
      parseTimestampMs(row.create_time) ??
      parseTimestampMs(row.confirmed_at) ??
      parseTimestampMs(row.first_seen_at) ??
      null;
    const todayFact = computeGridProfitDeltaSinceWindowStart({
      baselineGridProfit: anchor?.baselineGridProfit ?? null,
      firstWindowGridProfit: anchor?.firstWindowGridProfit ?? null,
      latestGridProfit: anchor?.latestGridProfit ?? null,
      startedAtMs,
      windowStartMs: dayStartMs,
    });
    const runtimePerDay =
      gridProfit !== null && startedAtMs !== null && Date.now() > startedAtMs
        ? roundMetric(gridProfit / ((Date.now() - startedAtMs) / 86400000))
        : null;

    lines.push(`🤖 ${symbol}${leverage !== null ? ` x${leverage}` : ""}`);
    lines.push(`💼 Капитал: ${formatMoney(equity)}`);
    lines.push(`🧾 Total: ${formatSignedUsd(totalPnl)}`);
    lines.push(`📈 По runtime/день: ${formatSignedUsd(runtimePerDay)}`);
    lines.push(`📆 Сегодня: ${formatSignedUsd(todayFact)}`);

    if (index < rows.length - 1) {
      lines.push("");
    }
  });

  lines.push("");
  lines.push("Команды: /status, /bots, /help");
  return lines.join("\n");
}

function buildHelpMessage() {
  return ["Доступные команды:", "/status — текущие активные боты", "/bots — то же самое", "/help — помощь"].join("\n");
}

function normalizeCommand(text: string) {
  const command = text.split(/\s+/)[0]?.trim().toLowerCase() || "";
  if (!command.startsWith("/")) {
    return null;
  }

  const base = command.split("@")[0];
  return ["/status", "/bots", "/help", "/start"].includes(base) ? base : null;
}

async function fetchTelegramUpdates(botToken: string, offset?: number) {
  const search = new URLSearchParams({ timeout: "0", limit: "20" });
  if (offset !== undefined) {
    search.set("offset", String(offset));
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${search.toString()}`);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok || !Array.isArray(json.result)) {
    throw new Error(`telegram getUpdates failed status=${response.status}`);
  }

  return json.result;
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`telegram sendMessage failed status=${response.status}`);
  }
}

function getTelegramSettings(dbPath: string) {
  const value = warehouse.getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
  const enabled = Boolean(value.enabled);
  const botToken = typeof value.botToken === "string" ? value.botToken.trim() : "";
  const chatId = typeof value.chatId === "string" ? value.chatId.trim() : "";

  if (!enabled || !botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
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

function formatMoney(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${value.toFixed(2)}$`;
}

function formatSignedUsd(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}$`;
}

function roundMetric(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}

type TelegramLogger = {
  log?: (message: string) => void;
  warn?: (message: string) => void;
};
