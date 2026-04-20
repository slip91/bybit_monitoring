const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOME = os.homedir();
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");

function loadMissingBybitEnvFromZshrc() {
  const zshrcPath = path.join(HOME, ".zshrc");
  if (!fs.existsSync(zshrcPath)) {
    return;
  }

  const zshrc = fs.readFileSync(zshrcPath, "utf8");
  for (const key of ["BYBIT_API_KEY", "BYBIT_API_SECRET", "BYBIT_ENV"]) {
    if (process.env[key]) {
      continue;
    }

    const match = zshrc.match(new RegExp(`^\\s*export\\s+${key}=([\"'])(.*?)\\1\\s*$`, "m"));
    if (match) {
      process.env[key] = match[2];
    }
  }
}

function getBybitEnv() {
  return process.env.BYBIT_ENV || "mainnet";
}

function getApiBase(bybitEnv) {
  return bybitEnv === "testnet" ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
}

function getRuntimeConfig() {
  loadMissingBybitEnvFromZshrc();

  const bybitEnv = getBybitEnv();
  return {
    projectRoot: WORKSPACE_ROOT,
    dbPath: process.env.BYBIT_BOTS_DB || path.join(WORKSPACE_ROOT, "db", "bybit-bots.sqlite"),
    chromeHistoryPath:
      process.env.BYBIT_CHROME_HISTORY ||
      path.join(HOME, "Library", "Application Support", "Google", "Chrome", "Default", "History"),
    listAllBotsUrl:
      process.env.BYBIT_LIST_ALL_BOTS_URL ||
      "https://www.bybit.com/x-api/s1/bot/tradingbot/v1/list-all-bots",
    recvWindow: process.env.BYBIT_RECV_WINDOW || "5000",
    bybitEnv,
    apiBase: getApiBase(bybitEnv),
  };
}

module.exports = {
  getRuntimeConfig,
  loadMissingBybitEnvFromZshrc,
};
