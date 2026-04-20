const Database = require("better-sqlite3");

const dbCache = new Map();

function queryJson(dbPath, sql) {
  const db = getDb(dbPath);
  return db.prepare(sql).all();
}

function execSql(dbPath, sql) {
  const db = getDb(dbPath);
  db.exec(sql);
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "NULL";
}

function getDb(dbPath) {
  if (dbCache.has(dbPath)) {
    return dbCache.get(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  dbCache.set(dbPath, db);
  return db;
}

function closeAllDbs() {
  for (const db of dbCache.values()) {
    try {
      db.close();
    } catch {}
  }
  dbCache.clear();
}

process.once("exit", closeAllDbs);
process.once("SIGINT", () => { closeAllDbs(); process.exit(128 + 2); });
process.once("SIGTERM", () => { closeAllDbs(); process.exit(128 + 15); });

module.exports = {
  closeAllDbs,
  execSql,
  queryJson,
  sqlNumber,
  sqlString,
};
