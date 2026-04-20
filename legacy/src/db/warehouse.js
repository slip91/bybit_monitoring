const fs = require("node:fs");
const path = require("node:path");

const { execSql, queryJson, sqlNumber, sqlString } = require("./sqlite");

const INIT_SQL_PATH = path.resolve(__dirname, "..", "..", "..", "db", "sql", "init_bot_warehouse.sql");
const SQLITE_BUSY_RETRY_COUNT = 3;
const SQLITE_BUSY_RETRY_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execSqlWithBusyRetry(dbPath, sql) {
  for (let attempt = 1; attempt <= SQLITE_BUSY_RETRY_COUNT; attempt++) {
    try {
      execSql(dbPath, sql);
      return;
    } catch (error) {
      const isBusy = error instanceof Error && (error.message.includes("database is locked") || error.message.includes("SQLITE_BUSY"));
      if (isBusy && attempt < SQLITE_BUSY_RETRY_COUNT) {
        console.warn(`[warehouse] SQLITE_BUSY on attempt ${attempt}, retrying in ${SQLITE_BUSY_RETRY_DELAY_MS * attempt}ms`);
        // eslint-disable-next-line no-await-in-loop
        sleep(SQLITE_BUSY_RETRY_DELAY_MS * attempt);
      } else {
        throw error;
      }
    }
  }
}

function ensureWarehouseSchema(dbPath) {
  const sql = fs.readFileSync(INIT_SQL_PATH, "utf8");
  execSql(dbPath, sql);
  ensureTableColumns(dbPath, "bot_snapshots", {
    grid_profit: "NUMERIC",
    leverage: "NUMERIC",
    create_time: "TEXT",
    operation_time_ms: "INTEGER",
    modify_time: "TEXT",
    end_time: "TEXT",
  });
  execSql(
    dbPath,
    "CREATE INDEX IF NOT EXISTS idx_bot_snapshots_create_time ON bot_snapshots (create_time DESC);"
  );
  ensureTableColumns(dbPath, "closed_bot_runs", {
    strategy_tag: "TEXT",
    close_reason: "TEXT",
    close_reason_detail: "TEXT",
    started_at: "TEXT",
    closed_at: "TEXT",
    first_observed_at: "TEXT",
    last_observed_at: "TEXT",
    snapshot_count: "INTEGER NOT NULL DEFAULT 0",
    investment: "NUMERIC",
    realized_pnl: "NUMERIC",
    unrealized_pnl: "NUMERIC",
    total_pnl: "NUMERIC",
    equity_at_close: "NUMERIC",
    leverage: "NUMERIC",
    lifetime_days: "NUMERIC",
    source: "TEXT NOT NULL DEFAULT 'completed_fgrid_history'",
    raw_metadata_json: "TEXT",
  });
  ensureTableColumns(dbPath, "stats_exclusions", {
    exclude_from_plan: "INTEGER NOT NULL DEFAULT 0",
    exclude_from_period_stats: "INTEGER NOT NULL DEFAULT 0",
    exclude_from_closed_stats: "INTEGER NOT NULL DEFAULT 0",
    exclude_reason: "TEXT",
    exclude_note: "TEXT",
  });
}

function upsertBotRecord(dbPath, bot, now, options = {}) {
  const matchCondition = buildBotMatchCondition(bot);
  const updateLastSnapshot = options.updateLastSnapshot !== false;
  const identityStatus = bot.bybit_bot_id ? "confirmed" : bot.identity_status || "unknown";
  const sql = `
BEGIN IMMEDIATE;
UPDATE bots
SET bybit_bot_id = COALESCE(bybit_bot_id, ${sqlString(bot.bybit_bot_id || null)}),
    guessed_key = COALESCE(guessed_key, ${sqlString(bot.guessed_key || null)}),
    identity_status = CASE
      WHEN ${sqlString(bot.bybit_bot_id || null)} IS NOT NULL THEN 'confirmed'
      ELSE COALESCE(${sqlString(identityStatus)}, identity_status)
    END,
    inference_confidence = COALESCE(${sqlNumber(bot.inference_confidence)}, inference_confidence),
    inference_reason = COALESCE(${sqlString(bot.inference_reason || null)}, inference_reason),
    symbol = COALESCE(${sqlString(bot.symbol)}, symbol),
    bot_type = COALESCE(${sqlString(bot.bot_type)}, bot_type),
    status = COALESCE(${sqlString(bot.status)}, status),
    route = COALESCE(${sqlString(bot.route)}, route),
    source = CASE
      WHEN source IS NULL OR source = '' THEN ${sqlString(bot.source || "active-bot-snapshot")}
      ELSE source
    END,
    is_active = 1,
    last_seen_at = ${sqlString(now)},
    last_snapshot_at = CASE
      WHEN ${updateLastSnapshot ? 1 : 0} = 1 THEN ${sqlString(now)}
      ELSE last_snapshot_at
    END,
    confirmed_at = COALESCE(confirmed_at, ${sqlString(bot.bybit_bot_id ? now : null)}),
    raw_metadata_json = COALESCE(${sqlString(bot.raw_metadata_json || null)}, raw_metadata_json),
    updated_at = ${sqlString(now)}
WHERE ${matchCondition};

INSERT INTO bots (
  bybit_bot_id,
  guessed_key,
  identity_status,
  inference_confidence,
  inference_reason,
  symbol,
  bot_type,
  status,
  route,
  source,
  is_active,
  first_seen_at,
  last_seen_at,
  confirmed_at,
  last_snapshot_at,
  raw_metadata_json,
  created_at,
  updated_at
)
SELECT
  ${sqlString(bot.bybit_bot_id)},
  ${sqlString(bot.guessed_key || null)},
  ${sqlString(identityStatus)},
  ${sqlNumber(bot.inference_confidence)},
  ${sqlString(bot.inference_reason || null)},
  ${sqlString(bot.symbol || null)},
  ${sqlString(bot.bot_type || "unknown")},
  ${sqlString(bot.status || null)},
  ${sqlString(bot.route || null)},
  ${sqlString(bot.source || "active-bot-snapshot")},
  1,
  ${sqlString(now)},
  ${sqlString(now)},
  ${sqlString(bot.bybit_bot_id ? now : null)},
  ${sqlString(now)},
  ${sqlString(bot.raw_metadata_json || null)},
  ${sqlString(now)},
  ${sqlString(now)}
WHERE NOT EXISTS (
  SELECT 1
  FROM bots
  WHERE ${matchCondition}
);
COMMIT;
`;

  execSqlWithBusyRetry(dbPath, sql);

  const rows = queryJson(
    dbPath,
    `SELECT bot_pk
     FROM bots
     WHERE ${matchCondition}
     LIMIT 1`
  );

  if (rows.length === 0) {
    throw new Error(`Failed to upsert bot record for bot_id=${bot.bybit_bot_id}`);
  }

  return rows[0].bot_pk;
}

function insertBotSnapshot(dbPath, snapshot) {
  const sql = `
INSERT INTO bot_snapshots (
  bot_pk, source, snapshot_time, symbol, bot_type, status,
  equity, total_pnl, total_apr, grid_apr, grid_profit, leverage, activity_count,
  investment, realized_pnl, unrealized_pnl, funding_fees,
  liquidation_price, total_order_balance, available_balance,
  position_balance, create_time, operation_time_ms, modify_time, end_time, raw_payload_json
) VALUES (
  ${sqlNumber(snapshot.bot_pk)},
  ${sqlString(snapshot.source || "active-bot-snapshot")},
  ${sqlString(snapshot.snapshot_time)},
  ${sqlString(snapshot.symbol || null)},
  ${sqlString(snapshot.bot_type || null)},
  ${sqlString(snapshot.status || null)},
  ${sqlNumber(snapshot.equity)},
  ${sqlNumber(snapshot.total_pnl)},
  ${sqlNumber(snapshot.total_apr)},
  ${sqlNumber(snapshot.grid_apr)},
  ${sqlNumber(snapshot.grid_profit)},
  ${sqlNumber(snapshot.leverage)},
  ${sqlNumber(snapshot.activity_count)},
  ${sqlNumber(snapshot.investment)},
  ${sqlNumber(snapshot.realized_pnl)},
  ${sqlNumber(snapshot.unrealized_pnl)},
  ${sqlNumber(snapshot.funding_fees)},
  ${sqlNumber(snapshot.liquidation_price)},
  ${sqlNumber(snapshot.total_order_balance)},
  ${sqlNumber(snapshot.available_balance)},
  ${sqlNumber(snapshot.position_balance)},
  ${sqlString(snapshot.create_time || null)},
  ${sqlNumber(snapshot.operation_time_ms)},
  ${sqlString(snapshot.modify_time || null)},
  ${sqlString(snapshot.end_time || null)},
  ${sqlString(snapshot.raw_payload_json || null)}
);`;

  execSqlWithBusyRetry(dbPath, sql);

  const rows = queryJson(
    dbPath,
    `SELECT snapshot_id
     FROM bot_snapshots
     WHERE bot_pk = ${sqlNumber(snapshot.bot_pk)}
       AND source = ${sqlString(snapshot.source || "active-bot-snapshot")}
       AND snapshot_time = ${sqlString(snapshot.snapshot_time)}
     ORDER BY snapshot_id DESC
     LIMIT 1`
  );

  if (rows.length === 0) {
    throw new Error(`Failed to insert bot snapshot for bot_pk=${snapshot.bot_pk}`);
  }

  return rows[0].snapshot_id;
}

function updateServiceStatus(dbPath, serviceName, fields) {
  const sql = `
INSERT INTO service_status (
  service_name,
  status,
  last_started_at,
  last_finished_at,
  last_success_at,
  last_error_at,
  last_error_message,
  last_snapshot_time,
  last_active_bots,
  last_snapshots_inserted,
  updated_at
) VALUES (
  ${sqlString(serviceName)},
  ${sqlString(fields.status || "idle")},
  NULLIF(${sqlString(fields.last_started_at ?? null)}, ''),
  NULLIF(${sqlString(fields.last_finished_at ?? null)}, ''),
  NULLIF(${sqlString(fields.last_success_at ?? null)}, ''),
  NULLIF(${sqlString(fields.last_error_at ?? null)}, ''),
  NULLIF(${sqlString(fields.last_error_message ?? null)}, ''),
  NULLIF(${sqlString(fields.last_snapshot_time ?? null)}, ''),
  ${sqlNumber(fields.last_active_bots)},
  ${sqlNumber(fields.last_snapshots_inserted)},
  ${sqlString(fields.updated_at || new Date().toISOString())}
)
ON CONFLICT(service_name) DO UPDATE SET
  status = COALESCE(excluded.status, service_status.status),
  last_started_at = COALESCE(excluded.last_started_at, service_status.last_started_at),
  last_finished_at = excluded.last_finished_at,
  last_success_at = COALESCE(excluded.last_success_at, service_status.last_success_at),
  last_error_at = excluded.last_error_at,
  last_error_message = excluded.last_error_message,
  last_snapshot_time = excluded.last_snapshot_time,
  last_active_bots = COALESCE(excluded.last_active_bots, service_status.last_active_bots),
  last_snapshots_inserted = COALESCE(excluded.last_snapshots_inserted, service_status.last_snapshots_inserted),
  updated_at = excluded.updated_at;
`;

  execSqlWithBusyRetry(dbPath, sql);
}

function getServiceStatus(dbPath, serviceName) {
  return (
    queryJson(
      dbPath,
      `SELECT
         service_name,
         status,
         last_started_at,
         last_finished_at,
         last_success_at,
         last_error_at,
         last_error_message,
         last_snapshot_time,
         last_active_bots,
         last_snapshots_inserted,
         updated_at
       FROM service_status
       WHERE service_name = ${sqlString(serviceName)}
       LIMIT 1`
    )[0] || null
  );
}

function getJsonSetting(dbPath, settingKey) {
  const row =
    queryJson(
      dbPath,
      `SELECT setting_value_json, updated_at
       FROM app_settings
       WHERE setting_key = ${sqlString(settingKey)}
       LIMIT 1`
    )[0] || null;

  if (!row) {
    return null;
  }

  return {
    value: safeJsonParse(row.setting_value_json),
    updated_at: row.updated_at || null,
  };
}

function upsertJsonSetting(dbPath, settingKey, value, updatedAt) {
  const sql = `
INSERT INTO app_settings (setting_key, setting_value_json, updated_at)
VALUES (
  ${sqlString(settingKey)},
  ${sqlString(JSON.stringify(value))},
  ${sqlString(updatedAt)}
)
ON CONFLICT(setting_key) DO UPDATE SET
  setting_value_json = excluded.setting_value_json,
  updated_at = excluded.updated_at;
`;

  execSql(dbPath, sql);
}

function ensureCurrentPlan(dbPath, now = new Date().toISOString()) {
  execSql(
    dbPath,
    `INSERT INTO plans (title, target_daily_pnl_usd, status, notes, is_current, created_at, updated_at)
     SELECT
       'План дохода',
       30,
       'active',
       'Цель по дневному результату для выбранных сеток.',
       1,
       ${sqlString(now)},
       ${sqlString(now)}
     WHERE NOT EXISTS (
       SELECT 1
       FROM plans
       WHERE is_current = 1
     );`
  );

  const rows = queryJson(
    dbPath,
    `SELECT plan_pk
     FROM plans
     WHERE is_current = 1
     ORDER BY plan_pk DESC
     LIMIT 1`
  );

  if (rows.length === 0) {
    throw new Error("Failed to ensure current plan.");
  }

  return rows[0].plan_pk;
}

function upsertCurrentPlan(dbPath, fields, now = new Date().toISOString()) {
  const planPk = ensureCurrentPlan(dbPath, now);
  execSql(
    dbPath,
    `UPDATE plans
     SET title = COALESCE(${sqlString(fields.title ?? null)}, title),
         target_daily_pnl_usd = COALESCE(${sqlNumber(fields.target_daily_pnl_usd)}, target_daily_pnl_usd),
         status = COALESCE(${sqlString(fields.status ?? null)}, status),
         notes = COALESCE(${sqlString(fields.notes ?? null)}, notes),
         updated_at = ${sqlString(now)}
     WHERE plan_pk = ${sqlNumber(planPk)}`
  );

  return planPk;
}

function ensureCurrentPlanMemberships(dbPath, planPk, now = new Date().toISOString()) {
  const existing = queryJson(
    dbPath,
    `SELECT COUNT(*) AS total
     FROM plan_bots
     WHERE plan_pk = ${sqlNumber(planPk)}`
  )[0];
  const defaultIncluded = Number(existing?.total) > 0 ? 0 : 1;

  execSql(
    dbPath,
    `INSERT INTO plan_bots (
       plan_pk,
       bot_pk,
       is_included,
       weight,
       created_at,
       updated_at
     )
     SELECT
       ${sqlNumber(planPk)},
       b.bot_pk,
       ${defaultIncluded},
       1,
       ${sqlString(now)},
       ${sqlString(now)}
     FROM bots b
     WHERE b.is_active = 1
       AND NOT EXISTS (
         SELECT 1
         FROM plan_bots pb
         WHERE pb.plan_pk = ${sqlNumber(planPk)}
           AND pb.bot_pk = b.bot_pk
       );`
  );
}

function upsertPlanBotMembership(dbPath, planPk, botPk, fields, now = new Date().toISOString()) {
  execSql(
    dbPath,
    `INSERT INTO plan_bots (
       plan_pk,
       bot_pk,
       is_included,
       weight,
       created_at,
       updated_at
     ) VALUES (
       ${sqlNumber(planPk)},
       ${sqlNumber(botPk)},
       ${fields.is_included ? 1 : 0},
       COALESCE(${sqlNumber(fields.weight)}, 1),
       ${sqlString(now)},
       ${sqlString(now)}
     )
     ON CONFLICT(plan_pk, bot_pk) DO UPDATE SET
       is_included = COALESCE(excluded.is_included, plan_bots.is_included),
       weight = COALESCE(excluded.weight, plan_bots.weight),
       updated_at = excluded.updated_at;`
  );
}

function syncClosedBotRunsFromCompletedHistory(dbPath, now = new Date().toISOString()) {
  execSql(
    dbPath,
     `INSERT INTO closed_bot_runs (
       legacy_bot_id,
       bot_pk,
       symbol,
       bot_type,
       started_at,
       closed_at,
       first_observed_at,
       last_observed_at,
       snapshot_count,
       investment,
       realized_pnl,
       unrealized_pnl,
       total_pnl,
       equity_at_close,
       leverage,
       lifetime_days,
       source,
       updated_at
     )
     WITH latest_completed AS (
       SELECT
         h.bot_id,
         h.symbol,
         CAST(NULLIF(TRIM(h.investment), '') AS REAL) AS investment,
         CAST(NULLIF(TRIM(h.realized_pnl), '') AS REAL) AS realized_pnl,
         CAST(NULLIF(TRIM(h.unrealized_pnl), '') AS REAL) AS unrealized_pnl,
         CAST(NULLIF(TRIM(h.total_pnl), '') AS REAL) AS total_pnl,
         CAST(NULLIF(TRIM(h.equity), '') AS REAL) AS equity_at_close,
         CAST(NULLIF(TRIM(h.leverage), '') AS REAL) AS leverage,
         h.snapshot_at,
         h.create_time,
         h.operation_time_ms,
         h.end_time,
         inv.bot_type
       FROM completed_fgrid_stats_history h
       JOIN (
         SELECT bot_id, MAX(snapshot_id) AS snapshot_id
         FROM completed_fgrid_stats_history
         GROUP BY bot_id
       ) latest ON latest.snapshot_id = h.snapshot_id
       LEFT JOIN bot_inventory inv ON inv.bot_id = h.bot_id
     ),
     completed_agg AS (
       SELECT
         bot_id,
         MIN(create_time) AS first_create_time,
         MAX(end_time) AS last_end_time,
         MAX(operation_time_ms) AS max_operation_time_ms,
         MIN(snapshot_at) AS first_observed_at,
         MAX(snapshot_at) AS last_observed_at,
         COUNT(*) AS snapshot_count,
         CASE
           WHEN COUNT(*) >= 2 THEN julianday(MAX(snapshot_at)) - julianday(MIN(snapshot_at))
           WHEN MAX(operation_time_ms) IS NOT NULL AND MAX(operation_time_ms) > 0 THEN MAX(operation_time_ms) / 86400000.0
           WHEN MIN(create_time) IS NOT NULL
             AND COALESCE(MAX(end_time), MAX(snapshot_at)) IS NOT NULL
             THEN julianday(COALESCE(MAX(end_time), MAX(snapshot_at))) - julianday(MIN(create_time))
           ELSE NULL
         END AS lifetime_days
       FROM completed_fgrid_stats_history
       GROUP BY bot_id
     )
     SELECT
       latest.bot_id,
       b.bot_pk,
       latest.symbol,
       COALESCE(latest.bot_type, 'futures_grid'),
       COALESCE(agg.first_create_time, agg.first_observed_at),
       COALESCE(agg.last_end_time, agg.last_observed_at),
       agg.first_observed_at,
       agg.last_observed_at,
       agg.snapshot_count,
       latest.investment,
       latest.realized_pnl,
       latest.unrealized_pnl,
       latest.total_pnl,
       latest.equity_at_close,
       latest.leverage,
       agg.lifetime_days,
       'completed_fgrid_history',
       ${sqlString(now)}
     FROM latest_completed latest
     JOIN completed_agg agg ON agg.bot_id = latest.bot_id
     LEFT JOIN bots b ON b.bybit_bot_id = latest.bot_id
     ON CONFLICT(legacy_bot_id) DO UPDATE SET
       bot_pk = COALESCE(excluded.bot_pk, closed_bot_runs.bot_pk),
       symbol = COALESCE(excluded.symbol, closed_bot_runs.symbol),
       bot_type = COALESCE(excluded.bot_type, closed_bot_runs.bot_type),
       started_at = COALESCE(excluded.started_at, closed_bot_runs.started_at),
       closed_at = excluded.closed_at,
       first_observed_at = excluded.first_observed_at,
       last_observed_at = excluded.last_observed_at,
       snapshot_count = excluded.snapshot_count,
       investment = excluded.investment,
       realized_pnl = excluded.realized_pnl,
       unrealized_pnl = excluded.unrealized_pnl,
       total_pnl = excluded.total_pnl,
       equity_at_close = excluded.equity_at_close,
       leverage = COALESCE(excluded.leverage, closed_bot_runs.leverage),
       lifetime_days = excluded.lifetime_days,
       source = COALESCE(excluded.source, closed_bot_runs.source),
       updated_at = excluded.updated_at;`
  );
}

function upsertBotStatsExclusion(dbPath, botPk, fields, now = new Date().toISOString()) {
  const normalized = normalizeExclusionFields(fields);
  if (!hasAnyExclusion(normalized)) {
    execSql(
      dbPath,
      `DELETE FROM stats_exclusions
       WHERE bot_pk = ${sqlNumber(botPk)}
         AND closed_run_pk IS NULL;`
    );
    return null;
  }

  const existing = getStatsExclusionByBotPk(dbPath, botPk);
  if (existing) {
    execSql(
      dbPath,
      `UPDATE stats_exclusions
       SET exclude_from_plan = ${normalized.exclude_from_plan ? 1 : 0},
           exclude_from_period_stats = ${normalized.exclude_from_period_stats ? 1 : 0},
           exclude_from_closed_stats = 0,
           exclude_reason = ${sqlString(normalized.exclude_reason)},
           exclude_note = ${sqlString(normalized.exclude_note)},
           updated_at = ${sqlString(now)}
       WHERE exclusion_pk = ${sqlNumber(existing.exclusion_pk)};`
    );
  } else {
    execSql(
      dbPath,
      `INSERT INTO stats_exclusions (
         bot_pk,
         closed_run_pk,
         exclude_from_plan,
         exclude_from_period_stats,
         exclude_from_closed_stats,
         exclude_reason,
         exclude_note,
         created_at,
         updated_at
       ) VALUES (
         ${sqlNumber(botPk)},
         NULL,
         ${normalized.exclude_from_plan ? 1 : 0},
         ${normalized.exclude_from_period_stats ? 1 : 0},
         0,
         ${sqlString(normalized.exclude_reason)},
         ${sqlString(normalized.exclude_note)},
         ${sqlString(now)},
         ${sqlString(now)}
       );`
    );
  }

  return getStatsExclusionByBotPk(dbPath, botPk);
}

function upsertClosedRunStatsExclusion(dbPath, closedRunPk, fields, now = new Date().toISOString()) {
  const normalized = normalizeExclusionFields(fields);
  if (!hasAnyExclusion(normalized)) {
    execSql(
      dbPath,
      `DELETE FROM stats_exclusions
       WHERE closed_run_pk = ${sqlNumber(closedRunPk)}
         AND bot_pk IS NULL;`
    );
    return null;
  }

  const existing = getStatsExclusionByClosedRunPk(dbPath, closedRunPk);
  if (existing) {
    execSql(
      dbPath,
      `UPDATE stats_exclusions
       SET exclude_from_plan = 0,
           exclude_from_period_stats = ${normalized.exclude_from_period_stats ? 1 : 0},
           exclude_from_closed_stats = ${normalized.exclude_from_closed_stats ? 1 : 0},
           exclude_reason = ${sqlString(normalized.exclude_reason)},
           exclude_note = ${sqlString(normalized.exclude_note)},
           updated_at = ${sqlString(now)}
       WHERE exclusion_pk = ${sqlNumber(existing.exclusion_pk)};`
    );
  } else {
    execSql(
      dbPath,
      `INSERT INTO stats_exclusions (
         bot_pk,
         closed_run_pk,
         exclude_from_plan,
         exclude_from_period_stats,
         exclude_from_closed_stats,
         exclude_reason,
         exclude_note,
         created_at,
         updated_at
       ) VALUES (
         NULL,
         ${sqlNumber(closedRunPk)},
         0,
         ${normalized.exclude_from_period_stats ? 1 : 0},
         ${normalized.exclude_from_closed_stats ? 1 : 0},
         ${sqlString(normalized.exclude_reason)},
         ${sqlString(normalized.exclude_note)},
         ${sqlString(now)},
         ${sqlString(now)}
       );`
    );
  }

  return getStatsExclusionByClosedRunPk(dbPath, closedRunPk);
}

function getStatsExclusionByBotPk(dbPath, botPk) {
  return (
    queryJson(
      dbPath,
      `SELECT *
       FROM stats_exclusions
       WHERE bot_pk = ${sqlNumber(botPk)}
         AND closed_run_pk IS NULL
       LIMIT 1`
    )[0] || null
  );
}

function getStatsExclusionByClosedRunPk(dbPath, closedRunPk) {
  return (
    queryJson(
      dbPath,
      `SELECT *
       FROM stats_exclusions
       WHERE closed_run_pk = ${sqlNumber(closedRunPk)}
         AND bot_pk IS NULL
       LIMIT 1`
    )[0] || null
  );
}

function normalizeExclusionFields(fields) {
  return {
    exclude_from_plan: Boolean(fields.exclude_from_plan),
    exclude_from_period_stats: Boolean(fields.exclude_from_period_stats),
    exclude_from_closed_stats: Boolean(fields.exclude_from_closed_stats),
    exclude_reason: normalizeExclusionReason(fields.exclude_reason),
    exclude_note: normalizeOptionalText(fields.exclude_note),
  };
}

function hasAnyExclusion(fields) {
  return fields.exclude_from_plan || fields.exclude_from_period_stats || fields.exclude_from_closed_stats;
}

function normalizeExclusionReason(value) {
  const allowed = new Set([
    "experiment",
    "technical",
    "duplicate",
    "invalid_data",
    "manual_ignore",
    "migration",
    "other",
  ]);

  return allowed.has(String(value)) ? String(value) : null;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 1000) : null;
}

function ensureTableColumns(dbPath, tableName, columns) {
  const existing = new Set(
    queryJson(dbPath, `PRAGMA table_info(${tableName})`).map((column) => column.name)
  );

  for (const [columnName, definition] of Object.entries(columns)) {
    if (existing.has(columnName)) {
      continue;
    }

    execSql(dbPath, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function buildBotMatchCondition(bot) {
  const conditions = [];

  if (bot.bybit_bot_id) {
    conditions.push(`bybit_bot_id = ${sqlString(bot.bybit_bot_id)}`);
  }

  if (bot.guessed_key) {
    conditions.push(`guessed_key = ${sqlString(bot.guessed_key)}`);
  }

  if (conditions.length === 0) {
    throw new Error("Cannot upsert bot without bybit_bot_id or guessed_key.");
  }

  return `(${conditions.join(" OR ")})`;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getBotLocalPeakMap(dbPath, bybitBotIds) {
  if (!Array.isArray(bybitBotIds) || bybitBotIds.length === 0) {
    return new Map();
  }

  const ids = [...new Set(bybitBotIds.filter(Boolean))];
  if (ids.length === 0) {
    return new Map();
  }

  const rows = queryJson(
    dbPath,
    `SELECT
       b.bybit_bot_id,
       MAX(bs.total_pnl) AS local_peak_total_pnl
     FROM bots b
     JOIN bot_snapshots bs ON bs.bot_pk = b.bot_pk
     WHERE b.bybit_bot_id IN (${ids.map((id) => sqlString(id)).join(", ")})
     GROUP BY b.bybit_bot_id`
  );

  return new Map(rows.map((row) => [row.bybit_bot_id, row.local_peak_total_pnl]));
}

module.exports = {
  ensureCurrentPlan,
  ensureCurrentPlanMemberships,
  ensureWarehouseSchema,
  getStatsExclusionByBotPk,
  getStatsExclusionByClosedRunPk,
  getJsonSetting,
  getServiceStatus,
  getBotLocalPeakMap,
  insertBotSnapshot,
  syncClosedBotRunsFromCompletedHistory,
  upsertBotStatsExclusion,
  upsertClosedRunStatsExclusion,
  upsertCurrentPlan,
  upsertJsonSetting,
  upsertPlanBotMembership,
  updateServiceStatus,
  upsertBotRecord,
};
