const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { queryJson } = require("../db/sqlite");

function inferSchema(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    return [inferSchema(value[0])];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, inferSchema(value[key])])
    );
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function normalizeListAllBots(payload) {
  const array = findBestObjectArray(payload);
  if (!array) {
    return [];
  }

  const bots = [];
  for (const item of array) {
    const botId = firstValue(item, ["bot_id", "botId", "id", "botid"]);
    if (!botId) {
      continue;
    }

    const symbol = firstValue(item, ["symbol", "coin_pair", "pair", "contract"]);
    const botTypeRaw = firstValue(item, [
      "bot_type",
      "botType",
      "strategy_type",
      "strategyType",
      "type",
      "bizType",
    ]);
    const status = firstValue(item, ["status", "bot_status", "state"]);
    const botType = mapBotType(botTypeRaw, symbol);

    bots.push({
      bot_id: String(botId),
      symbol: symbol ? String(symbol) : null,
      bot_type: botType,
      route: mapRoute(botType),
      status: status ? String(status) : null,
      source: "list-all-bots",
    });
  }

  return dedupeBots(bots);
}

function discoverBotsFromChromeHistory(chromeHistoryPath) {
  if (!fs.existsSync(chromeHistoryPath)) {
    return [];
  }

  const tempHistoryPath = path.join(os.tmpdir(), `bybit-history-${process.pid}.sqlite`);
  fs.copyFileSync(chromeHistoryPath, tempHistoryPath);

  try {
    const rows = queryJson(
      tempHistoryPath,
      `SELECT url
       FROM urls
       WHERE url LIKE '%/tradingbot/fgrid-details/?id=%'
          OR url LIKE '%/tradingbot/fmart-details/?id=%'
          OR url LIKE '%/tradingbot/details/?gid=%'`
    );

    const bots = [];
    for (const row of rows) {
      const url = row.url;
      let match = url.match(/\/tradingbot\/fgrid-details\/\?id=(\d+)/);
      if (match) {
        bots.push({
          bot_id: match[1],
          symbol: null,
          bot_type: "futures_grid",
          route: "fgrid-details",
          status: null,
          source: "chrome-history",
        });
        continue;
      }

      match = url.match(/\/tradingbot\/fmart-details\/\?id=(\d+)/);
      if (match) {
        bots.push({
          bot_id: match[1],
          symbol: null,
          bot_type: "futures_martingale",
          route: "fmart-details",
          status: null,
          source: "chrome-history",
        });
        continue;
      }

      match = url.match(/\/tradingbot\/details\/\?gid=(\d+)/);
      if (match) {
        bots.push({
          bot_id: match[1],
          symbol: null,
          bot_type: "unknown",
          route: "details-gid",
          status: null,
          source: "chrome-history",
        });
      }
    }

    return dedupeBots(bots);
  } finally {
    fs.rmSync(tempHistoryPath, { force: true });
  }
}

function findBestObjectArray(value, best = { score: 0, array: null }) {
  if (Array.isArray(value)) {
    const score = scoreArray(value);
    if (score > best.score) {
      best = { score, array: value };
    }

    for (const item of value) {
      best = findBestObjectArray(item, best);
    }

    return best.array;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findBestObjectArray(item, best);
      if (found && found !== best.array) {
        best = { score: scoreArray(found), array: found };
      }
    }
  }

  return best.array;
}

function scoreArray(array) {
  if (array.length === 0) {
    return 0;
  }

  const objectCount = array.filter((item) => item && typeof item === "object" && !Array.isArray(item)).length;
  if (objectCount === 0) {
    return 0;
  }

  const sample = array.find((item) => item && typeof item === "object" && !Array.isArray(item));
  const keys = new Set(Object.keys(sample || {}));
  let score = objectCount;

  for (const key of ["bot_id", "botId", "id", "symbol", "status", "type", "bot_type"]) {
    if (keys.has(key)) {
      score += 5;
    }
  }

  return score;
}

function mapBotType(rawValue, symbol) {
  const value = String(rawValue || "").toLowerCase();
  if (value.includes("grid") || (symbol && value.includes("future"))) {
    return "futures_grid";
  }
  if (value.includes("mart")) {
    return "futures_martingale";
  }
  return "unknown";
}

function mapRoute(botType) {
  if (botType === "futures_grid") {
    return "fgrid-details";
  }
  if (botType === "futures_martingale") {
    return "fmart-details";
  }
  return "unknown";
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && object[key] !== "") {
      return object[key];
    }
  }
  return null;
}

function dedupeBots(bots) {
  const seen = new Map();
  for (const bot of bots) {
    if (!bot.bot_id) {
      continue;
    }
    seen.set(bot.bot_id, { ...seen.get(bot.bot_id), ...bot });
  }
  return [...seen.values()];
}

module.exports = {
  discoverBotsFromChromeHistory,
  inferSchema,
  normalizeListAllBots,
};
