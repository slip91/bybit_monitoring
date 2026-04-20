const { buildCompletedSnapshot } = require("../metrics/fgrid");
const { execSql, queryJson, sqlNumber, sqlString } = require("./sqlite");

function ensureSchema(dbPath) {
  const schema = `
CREATE TABLE IF NOT EXISTS bot_inventory (
  bot_id TEXT PRIMARY KEY,
  symbol TEXT,
  bot_type TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT,
  source TEXT NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS completed_fgrid_stats_history (
  snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL REFERENCES bot_inventory(bot_id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  investment TEXT,
  realized_pnl TEXT,
  unrealized_pnl TEXT,
  total_pnl TEXT,
  apr TEXT,
  funding_fees TEXT,
  liquidation_price TEXT,
  arbitrage_count INTEGER,
  equity TEXT,
  leverage NUMERIC,
  create_time TEXT,
  operation_time_ms INTEGER,
  end_time TEXT,
  snapshot_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bot_inventory_type_status
  ON bot_inventory (bot_type, status);
CREATE INDEX IF NOT EXISTS idx_completed_history_bot_id
  ON completed_fgrid_stats_history (bot_id, snapshot_id DESC);
`;

  execSql(dbPath, schema);
  ensureTableColumns(dbPath, "completed_fgrid_stats_history", {
    leverage: "NUMERIC",
    create_time: "TEXT",
    operation_time_ms: "INTEGER",
    end_time: "TEXT",
  });
}

function loadInventory(dbPath) {
  return queryJson(
    dbPath,
    `SELECT bot_id, symbol, bot_type, route, status, source, discovered_at
     FROM bot_inventory`
  );
}

function loadActiveBots(dbPath) {
  return queryJson(
    dbPath,
    `SELECT bot_id, symbol, bot_type, route, status, source, discovered_at
     FROM bot_inventory
     WHERE status LIKE '%RUNNING%'
     ORDER BY bot_id`
  );
}

function upsertInventoryBots(dbPath, bots, now) {
  if (bots.length === 0) {
    return;
  }

  const statements = ["BEGIN IMMEDIATE;"];
  for (const bot of bots) {
    statements.push(`
INSERT INTO bot_inventory (bot_id, symbol, bot_type, route, status, source, discovered_at)
VALUES (
  ${sqlString(bot.bot_id)},
  ${sqlString(bot.symbol || null)},
  ${sqlString(bot.bot_type)},
  ${sqlString(bot.route || "unknown")},
  ${sqlString(bot.status || null)},
  ${sqlString(bot.source || "unknown")},
  COALESCE((SELECT discovered_at FROM bot_inventory WHERE bot_id = ${sqlString(bot.bot_id)}), ${sqlString(now)})
)
ON CONFLICT(bot_id) DO UPDATE SET
  symbol = COALESCE(excluded.symbol, bot_inventory.symbol),
  bot_type = COALESCE(excluded.bot_type, bot_inventory.bot_type),
  route = COALESCE(excluded.route, bot_inventory.route),
  status = COALESCE(excluded.status, bot_inventory.status),
  source = CASE
    WHEN bot_inventory.source IS NULL OR bot_inventory.source = '' THEN excluded.source
    ELSE bot_inventory.source
  END;`);
  }
  statements.push("COMMIT;");

  execSql(dbPath, statements.join("\n"));
}

function updateInventoryFromDetail(dbPath, detail) {
  const sql = `
UPDATE bot_inventory
SET symbol = ${sqlString(detail.symbol)},
    route = 'fgrid-details',
    status = ${sqlString(detail.status)}
WHERE bot_id = ${sqlString(detail.bot_id)};
`;

  execSql(dbPath, sql);
}

function insertCompletedSnapshotIfChanged(dbPath, detail, now) {
  const last = queryJson(
    dbPath,
    `SELECT snapshot_id, investment, realized_pnl, unrealized_pnl, total_pnl, apr,
            funding_fees, liquidation_price, arbitrage_count, equity,
            leverage,
            create_time, operation_time_ms, end_time
     FROM completed_fgrid_stats_history
     WHERE bot_id = ${sqlString(detail.bot_id)}
     ORDER BY snapshot_id DESC
     LIMIT 1`
  )[0];

  const current = buildCompletedSnapshot(detail);
  const runtimePatch = {
    leverage: numberOrNull(detail.leverage),
    create_time: epochMsToIso(detail.create_time),
    operation_time_ms: numberOrNull(detail.operation_time),
    end_time: epochMsToIso(detail.end_time),
  };

  if (last && shallowEqual(last, current)) {
    if (shouldPatchCompletedRuntime(last, runtimePatch)) {
      execSql(
        dbPath,
        `UPDATE completed_fgrid_stats_history
         SET create_time = COALESCE(create_time, ${sqlString(runtimePatch.create_time)}),
             leverage = COALESCE(leverage, ${sqlNumber(runtimePatch.leverage)}),
             operation_time_ms = COALESCE(operation_time_ms, ${sqlNumber(runtimePatch.operation_time_ms)}),
             end_time = COALESCE(end_time, ${sqlString(runtimePatch.end_time)})
         WHERE snapshot_id = ${sqlNumber(last.snapshot_id)};`
      );
      return true;
    }

    return false;
  }

  const sql = `
INSERT INTO completed_fgrid_stats_history (
  bot_id, symbol, investment, realized_pnl, unrealized_pnl, total_pnl,
  apr, funding_fees, liquidation_price, arbitrage_count, equity,
  leverage, create_time, operation_time_ms, end_time, snapshot_at
) VALUES (
  ${sqlString(detail.bot_id)},
  ${sqlString(detail.symbol)},
  ${sqlString(detail.investment)},
  ${sqlString(detail.realized_pnl)},
  ${sqlString(detail.unrealized_pnl)},
  ${sqlString(detail.total_pnl)},
  ${sqlString(detail.apr)},
  ${sqlString(detail.funding_fees)},
  ${sqlString(detail.liquidation_price)},
  ${sqlNumber(detail.arbitrage_count)},
  ${sqlString(detail.equity)},
  ${sqlNumber(detail.leverage)},
  ${sqlString(epochMsToIso(detail.create_time))},
  ${sqlNumber(detail.operation_time)},
  ${sqlString(epochMsToIso(detail.end_time))},
  ${sqlString(now)}
);`;

  execSql(dbPath, sql);
  return true;
}

function shallowEqual(left, right) {
  for (const key of Object.keys(right)) {
    if (String(left[key] ?? "") !== String(right[key] ?? "")) {
      return false;
    }
  }
  return true;
}

function shouldPatchCompletedRuntime(last, runtimePatch) {
  return (
    ((last.leverage === null || last.leverage === undefined || last.leverage === "") && runtimePatch.leverage !== null) ||
    (last.create_time === null || last.create_time === undefined || last.create_time === "") &&
      runtimePatch.create_time !== null
  ) || (
    (last.operation_time_ms === null || last.operation_time_ms === undefined || last.operation_time_ms === "") &&
      runtimePatch.operation_time_ms !== null
  ) || (
    (last.end_time === null || last.end_time === undefined || last.end_time === "") &&
      runtimePatch.end_time !== null
  );
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureTableColumns(dbPath, tableName, columns) {
  const current = queryJson(dbPath, `PRAGMA table_info(${tableName})`);
  const existing = new Set(current.map((column) => column.name));

  for (const [columnName, columnType] of Object.entries(columns)) {
    if (existing.has(columnName)) {
      continue;
    }

    execSql(dbPath, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`);
  }
}

function epochMsToIso(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

module.exports = {
  ensureSchema,
  insertCompletedSnapshotIfChanged,
  loadActiveBots,
  loadInventory,
  updateInventoryFromDetail,
  upsertInventoryBots,
};
