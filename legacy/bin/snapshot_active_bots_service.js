#!/usr/bin/env node

const { getRuntimeConfig } = require("../src/config/runtime");
const { ensureWarehouseSchema, updateServiceStatus } = require("../src/db/warehouse");
const { runActiveBotSnapshotCycle } = require("../src/services/activeBotSnapshotRunner");

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const SERVICE_NAME = "snapshot_active_bots";

let intervalHandle = null;
let activeRun = null;
let shutdownRequested = false;
let config = null;

main().catch((error) => {
  log("error", `service failed to start error=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  config = getRuntimeConfig();
  ensureWarehouseSchema(config.dbPath);
  updateServiceStatus(config.dbPath, SERVICE_NAME, {
    status: "idle",
    updated_at: new Date().toISOString(),
  });
  log("info", `service starting interval_ms=${SNAPSHOT_INTERVAL_MS}`);

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await runCycle();

  intervalHandle = setInterval(() => {
    void runCycle();
  }, SNAPSHOT_INTERVAL_MS);
}

async function runCycle() {
  if (shutdownRequested) {
    return;
  }

  if (activeRun) {
    log("warning", "previous snapshot cycle still running; skipping scheduled tick");
    return activeRun;
  }

  activeRun = runActiveBotSnapshotCycle({
    config,
    serviceName: SERVICE_NAME,
    logger: {
      info: (message) => log("info", message),
      error: (message) => log("error", message),
    },
  });

  try {
    await activeRun;
  } catch (error) {
    log("error", `snapshot cycle aborted error=${error instanceof Error ? error.message : String(error)}`);
  } finally {
    activeRun = null;
  }
}

async function shutdown(signal) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  log("info", `shutdown requested signal=${signal}`);

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  if (activeRun) {
    log("info", "waiting for active snapshot cycle to finish");
    try {
      await activeRun;
    } catch (error) {
      log("error", `active cycle finished with error=${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (config) {
    updateServiceStatus(config.dbPath, SERVICE_NAME, {
      status: "stopped",
      updated_at: new Date().toISOString(),
    });
  }

  log("info", "service stopped");
  process.exit(0);
}

function log(level, message) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
