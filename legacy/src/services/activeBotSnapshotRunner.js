const { createBybitClient } = require("../bybit/api");
const { evaluateAlertsForSnapshot } = require("../alerts/rules");
const { getRuntimeConfig } = require("../config/runtime");
const { ensureSchema, loadActiveBots } = require("../db/botStore");
const { ensureWarehouseSchema, insertBotSnapshot, updateServiceStatus, upsertBotRecord } = require("../db/warehouse");
const { buildActiveBotSnapshotRecord } = require("../metrics/fgrid");
const {
  detectBotClosure,
  detectTradeActivity,
  getPreviousSnapshotForBot,
  notifyTelegramAboutBotClosure,
  notifyTelegramAboutTradeActivity,
} = require("./telegramTradeNotifications");

async function runActiveBotSnapshotCycle(options = {}) {
  const config = options.config || getRuntimeConfig();
  const client = options.client || createBybitClient(config);
  const snapshotTime = options.snapshotTime || new Date().toISOString();
  const logger = options.logger || null;
  const serviceName = options.serviceName || "snapshot_active_bots";

  ensureSchema(config.dbPath);
  ensureWarehouseSchema(config.dbPath);

  log(logger, "info", `snapshot cycle started db=${config.dbPath} env=${config.bybitEnv}`);

  const activeBots = loadActiveBots(config.dbPath);
  log(logger, "info", `active bots found=${activeBots.length}`);

  const summary = {
    db_path: config.dbPath,
    bybit_env: config.bybitEnv,
    snapshot_time: snapshotTime,
    source_active_bots: activeBots.length,
    snapshots_inserted: 0,
    snapshots_skipped: 0,
    detail_failures: [],
  };

  updateServiceStatus(config.dbPath, serviceName, {
    status: "running",
    last_started_at: snapshotTime,
    last_snapshot_time: snapshotTime,
    last_active_bots: activeBots.length,
    updated_at: snapshotTime,
  });

  try {
    if (activeBots.length === 0) {
      updateServiceStatus(config.dbPath, serviceName, {
        status: "ok",
        last_finished_at: snapshotTime,
        last_success_at: snapshotTime,
        last_snapshot_time: snapshotTime,
        last_active_bots: 0,
        last_snapshots_inserted: 0,
        last_error_at: "",
        last_error_message: "",
        updated_at: snapshotTime,
      });
      log(logger, "info", "snapshot cycle completed snapshots_inserted=0 detail_failures=0");
      return summary;
    }

    try {
      client.requireBybitCredentials();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(logger, "error", `missing bybit credentials: ${errorMessage}`);
      updateServiceStatus(config.dbPath, serviceName, {
        status: "error",
        last_finished_at: snapshotTime,
        last_error_at: snapshotTime,
        last_error_message: errorMessage,
        last_snapshot_time: snapshotTime,
        last_active_bots: activeBots.length,
        last_snapshots_inserted: 0,
        updated_at: snapshotTime,
      });
      return {
        ...summary,
        detail_failures: activeBots.map((bot) => ({
          bot_id: bot.bot_id,
          error: `credentials missing: ${errorMessage}`,
        })),
        snapshots_skipped: activeBots.length,
      };
    }

    for (const bot of activeBots) {
      let detail = null;
      let errorMessage = null;

      try {
        detail = await client.fetchFGridDetail(bot.bot_id);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        summary.detail_failures.push({
          bot_id: bot.bot_id,
          error: errorMessage,
        });
        summary.snapshots_skipped += 1;
        log(logger, "error", `bot snapshot failed bot_id=${bot.bot_id} error=${errorMessage}`);

        upsertBotRecord(
          config.dbPath,
          {
            bybit_bot_id: bot.bot_id,
            symbol: bot.symbol ?? null,
            bot_type: bot.bot_type ?? null,
            status: bot.status ?? null,
            route: bot.route ?? null,
            source: bot.source || "active-bot-snapshot",
            raw_metadata_json: JSON.stringify({
              last_detail_error: errorMessage,
              updated_at: snapshotTime,
            }),
          },
          snapshotTime,
          { updateLastSnapshot: false }
        );
        continue;
      }

      const snapshot = buildActiveBotSnapshotRecord(bot, detail, snapshotTime, null);
      const botPk = upsertBotRecord(config.dbPath, snapshot, snapshotTime);
      const previousSnapshot = getPreviousSnapshotForBot(config.dbPath, botPk);
      const snapshotId = insertBotSnapshot(config.dbPath, {
        ...snapshot,
        bot_pk: botPk,
      });
      await evaluateAlertsForSnapshot(
        config.dbPath,
        {
          bot_pk: botPk,
          bybit_bot_id: snapshot.bybit_bot_id,
          symbol: snapshot.symbol,
        },
        snapshot,
        snapshotId
      );
      const botClosureEvent = detectBotClosure(previousSnapshot, snapshot, detail);
      if (botClosureEvent) {
        await notifyTelegramAboutBotClosure(
          config.dbPath,
          {
            bot_pk: botPk,
            bybit_bot_id: snapshot.bybit_bot_id,
            symbol: snapshot.symbol,
            leverage: snapshot.leverage,
          },
          snapshot,
          botClosureEvent,
          logger
        );
      }
      const tradeActivityEvent = detectTradeActivity(previousSnapshot, snapshot);
      if (!botClosureEvent && tradeActivityEvent) {
        await notifyTelegramAboutTradeActivity(
          config.dbPath,
          {
            bot_pk: botPk,
            bybit_bot_id: snapshot.bybit_bot_id,
            symbol: snapshot.symbol,
            leverage: snapshot.leverage,
          },
          snapshot,
          tradeActivityEvent,
          logger
        );
      }
      summary.snapshots_inserted += 1;
    }

    updateServiceStatus(config.dbPath, serviceName, {
      status: summary.detail_failures.length > 0 ? "error" : "ok",
      last_finished_at: snapshotTime,
      last_success_at: summary.detail_failures.length === 0 ? snapshotTime : null,
      last_snapshot_time: snapshotTime,
      last_active_bots: activeBots.length,
      last_snapshots_inserted: summary.snapshots_inserted,
      last_error_at: summary.detail_failures.length > 0 ? snapshotTime : "",
      last_error_message:
        summary.detail_failures.length > 0 ? `${summary.detail_failures[0].bot_id}: ${summary.detail_failures[0].error}` : "",
      updated_at: snapshotTime,
    });

    log(
      logger,
      "info",
      `snapshot cycle completed snapshots_inserted=${summary.snapshots_inserted} detail_failures=${summary.detail_failures.length}`
    );

    return summary;
  } catch (error) {
    updateServiceStatus(config.dbPath, serviceName, {
      status: "error",
      last_finished_at: snapshotTime,
      last_error_at: snapshotTime,
      last_error_message: error instanceof Error ? error.message : String(error),
      last_snapshot_time: snapshotTime,
      last_active_bots: activeBots.length,
      last_snapshots_inserted: summary.snapshots_inserted,
      updated_at: snapshotTime,
    });
    throw error;
  }
}

function log(logger, level, message) {
  if (!logger || typeof logger[level] !== "function") {
    return;
  }

  logger[level](message);
}

module.exports = {
  runActiveBotSnapshotCycle,
};
