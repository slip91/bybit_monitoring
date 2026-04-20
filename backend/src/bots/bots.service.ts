import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, bybitApi, dto, runtime, warehouse } from "../shared/legacy-bridge";
import { computeGridProfitDeltaSinceWindowStart, parseTimestampMs, startOfLocalDayMs } from "../shared/current-day-profit";
import {
  normalizeInterval,
  normalizePriceSource,
  normalizeRange,
  normalizeStartedAt,
  selectRangeStartMs,
  toNullableNumber,
  MarketChartRange,
} from "./market-chart";

type LegacyBotRow = Record<string, unknown> & {
  bot_pk: number | string;
  create_time?: string | null;
  confirmed_at?: string | null;
  first_seen_at?: string | null;
};

@Injectable()
export class BotsService {
  constructor() {}

  /**
   * Получить список всех ботов с расчетом дохода за текущий день
   */
  async listBots() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const rows = apiStore.listBots(dbPath) as LegacyBotRow[];
    
    // Рассчитываем доход за текущий день для каждого бота
    const todayGridProfitByBotPk = buildTodayGridProfitMap(
      rows,
      apiStore.listBotGridProfitAnchors(
        dbPath,
        rows.map((row) => row.bot_pk),
        new Date(startOfLocalDayMs(Date.now())).toISOString(),
      ),
    );

    return rows.map((row) =>
      dto.toBotListItemDto({
        ...row,
        factPnlPerDay: todayGridProfitByBotPk.get(Number(row.bot_pk)) ?? null,
      }),
    );
  }

  /**
   * Получить детальную информацию о боте
   */
  async getBot(botId: string) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const latestSnapshot = apiStore.getLatestBotSnapshot(dbPath, bot.bot_pk);
    const todayGridProfit = buildTodayGridProfitMap(
      [
        latestSnapshot
          ? {
              ...latestSnapshot,
              bot_pk: bot.bot_pk,
              confirmed_at: bot.confirmed_at,
              first_seen_at: bot.first_seen_at,
            }
          : bot,
      ],
      apiStore.listBotGridProfitAnchors(dbPath, [bot.bot_pk], new Date(startOfLocalDayMs(Date.now())).toISOString()),
    ).get(Number(bot.bot_pk)) ?? null;

    return dto.toBotDetailsDto(
      bot,
      latestSnapshot
        ? {
            ...latestSnapshot,
            factPnlPerDay: todayGridProfit,
          }
        : latestSnapshot,
    );
  }

  async getBotSnapshots(botId: string, limit: number) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    return apiStore.getBotSnapshots(dbPath, botId, limit).map(dto.toBotSnapshotDto);
  }

  async getBotMarketChart(botId: string, intervalParam?: string, rangeParam?: string, priceSourceParam?: string) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const latestSnapshot = apiStore.getLatestBotSnapshot(dbPath, bot.bot_pk);

    let detail: Record<string, unknown>;
    let candles: unknown[];
    let overlays: Record<string, unknown>;
    let grid: Record<string, unknown>;
    let symbol: string;
    let lifetimeStartedAt: number | null;
    let interval: string;
    let range: string;

    try {
      const config = runtime.getRuntimeConfig();
      detail = await bybitApi.fetchRawFGridDetail(config, bot.bybit_bot_id || botId);
      symbol = String(detail.symbol || bot.symbol || "");
      lifetimeStartedAt = normalizeStartedAt(
        detail.create_time as string | null | undefined,
        latestSnapshot?.create_time,
        bot.confirmed_at,
        bot.first_seen_at
      );
      const endedAtMs = Date.now();
      interval = normalizeInterval(intervalParam, lifetimeStartedAt, endedAtMs);
      range = normalizeRange(rangeParam);
      const priceSource = normalizePriceSource(priceSourceParam);
      const startedAt = selectRangeStartMs(range as MarketChartRange, lifetimeStartedAt, endedAtMs);
      candles = await fetchMarketKlines(config.apiBase, {
        symbol,
        interval,
        startMs: startedAt,
        endMs: endedAtMs,
      });

      overlays = {
        currentPrice: toNullableNumber(detail.last_price) ?? toNullableNumber(detail.mark_price),
        entryPrice: toNullableNumber(detail.entry_price),
        lowerRangePrice: toNullableNumber(detail.curr_min_price) ?? toNullableNumber(detail.min_price),
        upperRangePrice: toNullableNumber(detail.curr_max_price) ?? toNullableNumber(detail.max_price),
        takeProfitPrice: toNullableNumber(detail.take_profit_price),
        stopLossPrice: toNullableNumber(detail.stop_loss_price),
        markPrice: toNullableNumber(detail.mark_price),
      };
      grid = {
        count: toNullableNumber(detail.cell_number),
      };
    } catch (error) {
      // Graceful degradation: возвращаем то что есть из БД, без market data
      symbol = String(bot.symbol || "");
      lifetimeStartedAt = normalizeStartedAt(null, latestSnapshot?.create_time, bot.confirmed_at, bot.first_seen_at);
      const endedAtMs = Date.now();
      interval = normalizeInterval(intervalParam, lifetimeStartedAt, endedAtMs);
      range = normalizeRange(rangeParam);
      candles = [];
      overlays = {};
      grid = {};
    }

    return {
      botId: bot.bybit_bot_id || botId,
      symbol,
      startedAt: lifetimeStartedAt === null ? null : new Date(lifetimeStartedAt).toISOString(),
      interval,
      range,
      priceSource: normalizePriceSource(priceSourceParam),
      candles,
      overlays,
      grid,
    };
  }
}

function buildTodayGridProfitMap(rows: Array<Record<string, unknown>>, anchors: Array<Record<string, unknown>>) {
  const anchorByBotPk = new Map(
    anchors.map((row) => [
      Number(row.bot_pk),
      {
        baselineGridProfit: toNullableNumber(row.baseline_grid_profit),
        firstWindowGridProfit: toNullableNumber(row.first_window_grid_profit),
        latestGridProfit: toNullableNumber(row.latest_grid_profit),
      },
    ]),
  );
  const dayStartMs = startOfLocalDayMs(Date.now());

  return new Map(
    rows.map((row) => {
      const botPk = Number(row.bot_pk);
      const anchor = anchorByBotPk.get(botPk);
      const startedAtMs =
        parseTimestampMs(row.create_time as string | null | undefined) ??
        parseTimestampMs(row.confirmed_at as string | null | undefined) ??
        parseTimestampMs(row.first_seen_at as string | null | undefined) ??
        parseTimestampMs(row.first_seen_at) ??
        null;

      return [
        botPk,
        computeGridProfitDeltaSinceWindowStart({
          baselineGridProfit: anchor?.baselineGridProfit ?? null,
          firstWindowGridProfit: anchor?.firstWindowGridProfit ?? null,
          latestGridProfit: anchor?.latestGridProfit ?? null,
          startedAtMs,
          windowStartMs: dayStartMs,
        }),
      ];
    }),
  );
}

async function fetchMarketKlines(
  apiBase: string,
  options: {
    symbol: string;
    interval: string;
    startMs: number | null;
    endMs: number;
  },
) {
  const search = new URLSearchParams({
    category: "linear",
    symbol: options.symbol,
    interval: options.interval,
    limit: "1000",
  });

  if (options.startMs !== null) {
    search.set("start", String(options.startMs));
  }
  search.set("end", String(options.endMs));

  const response = await fetch(`${apiBase}/v5/market/kline?${search.toString()}`, {
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`market/kline failed with HTTP ${response.status}`);
  }
  if (!json || json.retCode !== 0 || !Array.isArray(json.result?.list)) {
    throw new Error(`market/kline returned invalid payload for ${options.symbol}`);
  }

  return [...json.result.list]
    .map((entry: string[]) => ({
      time: Math.floor(Number(entry[0]) / 1000),
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
    }))
    .filter((entry: { time: number; open: number; high: number; low: number; close: number }) =>
      [entry.time, entry.open, entry.high, entry.low, entry.close].every((value) => Number.isFinite(value))
    )
    .sort((left, right) => left.time - right.time);
}
