const crypto = require("node:crypto");

const { normalizeFGridDetail } = require("../metrics/fgrid");

function createBybitClient(config) {
  return {
    fetchFGridDetail(botId) {
      return fetchFGridDetail(config, botId);
    },
    fetchRawFGridDetail(botId) {
      return fetchRawFGridDetail(config, botId);
    },
    requireBybitCredentials,
    tryFetchListAllBots() {
      return tryFetchListAllBots(config);
    },
  };
}

function requireBybitCredentials() {
  if (!process.env.BYBIT_API_KEY || !process.env.BYBIT_API_SECRET) {
    throw new Error("Missing BYBIT_API_KEY or BYBIT_API_SECRET.");
  }
}

async function fetchFGridDetail(config, botId) {
  return normalizeFGridDetail(await fetchRawFGridDetail(config, botId));
}

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRawFGridDetail(config, botId, retries = MAX_RETRIES) {
  const body = JSON.stringify({ bot_id: String(botId) });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await bybitSignedFetch(config, "/v5/fgridbot/detail", body);
      const json = await response.json();

      if (!response.ok) {
        // 429 rate limit или 5xx — retry
        const isRetryable = response.status === 429 || response.status >= 500;
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        if (isRetryable && attempt < retries) {
          const delayMs = retryAfter
            ? retryAfter * 1000
            : Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
          console.warn(
            `[bybit/api] fetchRawFGridDetail ${botId} attempt ${attempt}/${retries} failed with HTTP ${response.status}, retrying in ${delayMs}ms`
          );
          await sleep(delayMs);
          continue;
        }
        throw new Error(`fgridbot/detail ${botId} failed with HTTP ${response.status}`);
      }
      if (json.retCode !== 0) {
        throw new Error(`fgridbot/detail ${botId} retCode=${json.retCode} retMsg=${json.retMsg}`);
      }
      if (!json.result || !json.result.detail) {
        throw new Error(`fgridbot/detail ${botId} returned no detail block`);
      }

      return json.result.detail;
    } catch (error) {
      const isNetworkError = error.message.startsWith("network error calling");
      if (isNetworkError && attempt < retries) {
        const delayMs = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
        console.warn(
          `[bybit/api] fetchRawFGridDetail ${botId} attempt ${attempt}/${retries} failed: ${error.message}, retrying in ${delayMs}ms`
        );
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }
}

function parseRetryAfter(value) {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function tryFetchListAllBots(config) {
  const cookie = process.env.BYBIT_LIST_ALL_BOTS_COOKIE;
  if (!cookie) {
    return null;
  }

  const method = (process.env.BYBIT_LIST_ALL_BOTS_METHOD || "GET").toUpperCase();
  const body = process.env.BYBIT_LIST_ALL_BOTS_BODY || undefined;
  const headers = {
    accept: "application/json, text/plain, */*",
    "accept-language": process.env.BYBIT_LIST_ALL_BOTS_ACCEPT_LANGUAGE || "ru-RU,ru;q=0.9,en;q=0.8",
    cookie,
    origin: "https://www.bybit.com",
    referer:
      process.env.BYBIT_LIST_ALL_BOTS_REFERER || "https://www.bybit.com/ru-RU/tradingbot/my-bot/",
    "user-agent":
      process.env.BYBIT_LIST_ALL_BOTS_USER_AGENT ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "x-requested-with": "XMLHttpRequest",
  };

  if (process.env.BYBIT_LIST_ALL_BOTS_HEADERS_JSON) {
    Object.assign(headers, JSON.parse(process.env.BYBIT_LIST_ALL_BOTS_HEADERS_JSON));
  }
  if (body && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(config.listAllBotsUrl, {
    method,
    headers,
    body: method === "GET" ? undefined : body,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`list-all-bots failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("list-all-bots returned non-JSON response");
  }
}

async function bybitSignedFetch(config, endpoint, body) {
  const apiKey = process.env.BYBIT_API_KEY;
  const apiSecret = process.env.BYBIT_API_SECRET;
  const timestamp = String(Date.now());
  const signPayload = `${timestamp}${apiKey}${config.recvWindow}${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(signPayload).digest("hex");

  try {
    return await fetch(`${config.apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bapi-api-key": apiKey,
        "x-bapi-recv-window": config.recvWindow,
        "x-bapi-sign": signature,
        "x-bapi-timestamp": timestamp,
      },
      body,
    });
  } catch (error) {
    const wrapped = new Error(
      `network error calling ${endpoint}: ${error instanceof Error ? error.message : String(error)}`
    );
    wrapped.cause = error;
    throw wrapped;
  }
}

module.exports = {
  createBybitClient,
  fetchRawFGridDetail,
};
