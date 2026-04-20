#!/usr/bin/env node

const { createBybitClient } = require("../src/bybit/api");
const { discoverBotsFromChromeHistory, inferSchema, normalizeListAllBots } = require("../src/bybit/discovery");
const { getRuntimeConfig } = require("../src/config/runtime");
const {
  ensureSchema,
  insertCompletedSnapshotIfChanged,
  loadInventory,
  updateInventoryFromDetail,
  upsertInventoryBots,
} = require("../src/db/botStore");
const { formatRefreshSummary } = require("../src/reports/formatters");

const MODE = parseMode(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const config = getRuntimeConfig();
  const client = createBybitClient(config);
  const now = new Date().toISOString();

  ensureSchema(config.dbPath);

  const summary = {
    db_path: config.dbPath,
    bybit_env: config.bybitEnv,
    browser_list_attempted: false,
    browser_list_ok: false,
    browser_schema: null,
    browser_discovered: 0,
    db_inventory_loaded: 0,
    history_discovered: 0,
    futures_grid_refreshed: 0,
    running_futures_grid: 0,
    completed_futures_grid: 0,
    snapshots_inserted: 0,
    detail_failures: [],
  };

  const inventory = new Map();
  for (const bot of loadInventory(config.dbPath)) {
    inventory.set(bot.bot_id, bot);
  }
  summary.db_inventory_loaded = inventory.size;

  let listAllBotsPayload = null;
  if (MODE === "auto" && process.env.BYBIT_LIST_ALL_BOTS_COOKIE) {
    summary.browser_list_attempted = true;
    listAllBotsPayload = await client.tryFetchListAllBots();
    if (listAllBotsPayload) {
      summary.browser_list_ok = true;
      summary.browser_schema = inferSchema(listAllBotsPayload);
      const discovered = normalizeListAllBots(listAllBotsPayload);
      for (const bot of discovered) {
        inventory.set(bot.bot_id, { ...inventory.get(bot.bot_id), ...bot });
      }
      summary.browser_discovered = discovered.length;
    }
  }

  if (MODE !== "api-only") {
    const discoveredFromHistory = discoverBotsFromChromeHistory(config.chromeHistoryPath);
    for (const bot of discoveredFromHistory) {
      inventory.set(bot.bot_id, { ...inventory.get(bot.bot_id), ...bot });
    }
    summary.history_discovered = discoveredFromHistory.length;
  }

  if (inventory.size === 0) {
    throw new Error(
      "No bot ids found. Seed the DB, enable browser list request env, or keep Chrome history available."
    );
  }

  const allBots = [...inventory.values()].sort((a, b) => a.bot_id.localeCompare(b.bot_id));
  upsertInventoryBots(config.dbPath, allBots, now);

  const futuresGridBots = allBots.filter((bot) => bot.bot_type === "futures_grid");
  client.requireBybitCredentials();

  for (const bot of futuresGridBots) {
    try {
      const detail = await client.fetchFGridDetail(bot.bot_id);
      updateInventoryFromDetail(config.dbPath, detail);
      summary.futures_grid_refreshed += 1;

      if (detail.status === "FUTURE_GRID_STATUS_COMPLETED") {
        summary.completed_futures_grid += 1;
        if (insertCompletedSnapshotIfChanged(config.dbPath, detail, now)) {
          summary.snapshots_inserted += 1;
        }
      } else if (detail.status === "FUTURE_GRID_STATUS_RUNNING") {
        summary.running_futures_grid += 1;
      }
    } catch (error) {
      summary.detail_failures.push({
        bot_id: bot.bot_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(formatRefreshSummary(summary));
}

function parseMode(args) {
  if (args.includes("--history-only")) {
    return "history-only";
  }
  if (args.includes("--api-only")) {
    return "api-only";
  }
  return "auto";
}
