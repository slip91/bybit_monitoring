#!/usr/bin/env node

const { createBybitClient } = require("../src/bybit/api");
const { getRuntimeConfig } = require("../src/config/runtime");
const { loadActiveBots } = require("../src/db/botStore");
const { getBotLocalPeakMap } = require("../src/db/warehouse");
const { buildActiveBotReportRow } = require("../src/metrics/fgrid");
const {
  createActiveBotsJsonReport,
  formatActiveBotsTitle,
  getActiveBotsNote,
} = require("../src/reports/formatters");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const config = getRuntimeConfig();
  const client = createBybitClient(config);
  client.requireBybitCredentials();

  const activeBots = loadActiveBots(config.dbPath);

  if (activeBots.length === 0) {
    console.log("No active bots found in local DB.");
    return;
  }

  const localPeakMap = getBotLocalPeakMap(
    config.dbPath,
    activeBots.map((bot) => bot.bot_id)
  );

  const rows = [];
  for (const bot of activeBots) {
    const detail = await client.fetchFGridDetail(bot.bot_id);
    rows.push(
      buildActiveBotReportRow({
        ...bot,
        ...detail,
        local_peak_total_pnl: localPeakMap.get(bot.bot_id) ?? null,
      })
    );
  }

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(createActiveBotsJsonReport(config.bybitEnv, rows), null, 2));
    return;
  }

  console.log(formatActiveBotsTitle(config.bybitEnv));
  console.table(rows);
  console.log(getActiveBotsNote());
}
