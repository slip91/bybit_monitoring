const { execSql, queryJson, sqlNumber, sqlString } = require("../db/sqlite");
const { getJsonSetting } = require("../db/warehouse");

const TOTAL_PNL_THRESHOLD_RULE = "total_pnl_threshold";
const GRID_PROFIT_CAPTURE_READY_RULE = "grid_profit_capture_ready";
const TELEGRAM_ALERT_SETTINGS_KEY = "telegram_alert_settings";

function listBotAlertRules(dbPath) {
  return queryJson(
    dbPath,
    `WITH latest_snapshots AS (
       SELECT s.*
       FROM bot_snapshots s
       WHERE s.snapshot_id = (
         SELECT s2.snapshot_id
         FROM bot_snapshots s2
         WHERE s2.bot_pk = s.bot_pk
         ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
         LIMIT 1
       )
     )
     SELECT
       b.bot_pk,
       b.bybit_bot_id,
       COALESCE(ls.symbol, b.symbol) AS symbol,
       COALESCE(ls.bot_type, b.bot_type) AS bot_type,
       COALESCE(ls.status, b.status) AS status,
       ls.total_pnl,
       ls.grid_profit,
       r_total.rule_pk AS total_rule_pk,
       r_total.rule_type AS total_rule_type,
       r_total.is_enabled AS total_is_enabled,
       r_total.comparison_operator AS total_comparison_operator,
       r_total.threshold_value AS total_threshold_value,
       r_total.severity AS total_severity,
       r_total.title AS total_title,
       r_total.last_triggered_at AS total_last_triggered_at,
       r_total.updated_at AS total_updated_at,
       r_grid.rule_pk AS grid_rule_pk,
       r_grid.rule_type AS grid_rule_type,
       r_grid.is_enabled AS grid_is_enabled,
       r_grid.severity AS grid_severity,
       r_grid.title AS grid_title,
       r_grid.last_triggered_at AS grid_last_triggered_at,
       r_grid.updated_at AS grid_updated_at
     FROM bots b
     LEFT JOIN latest_snapshots ls ON ls.bot_pk = b.bot_pk
     LEFT JOIN bot_alert_rules r_total
       ON r_total.bot_pk = b.bot_pk
      AND r_total.rule_type = ${sqlString(TOTAL_PNL_THRESHOLD_RULE)}
     LEFT JOIN bot_alert_rules r_grid
       ON r_grid.bot_pk = b.bot_pk
      AND r_grid.rule_type = ${sqlString(GRID_PROFIT_CAPTURE_READY_RULE)}
     WHERE b.is_active = 1
     ORDER BY COALESCE(ls.symbol, b.symbol, b.bybit_bot_id) ASC, b.bot_pk ASC`
  );
}

function upsertTotalPnlRule(dbPath, input, now) {
  const sql = `
INSERT INTO bot_alert_rules (
  bot_pk,
  rule_type,
  is_enabled,
  comparison_operator,
  threshold_value,
  severity,
  title,
  updated_at
) VALUES (
  ${sqlNumber(input.bot_pk)},
  ${sqlString(TOTAL_PNL_THRESHOLD_RULE)},
  ${input.is_enabled ? 1 : 0},
  ${sqlString(input.comparison_operator || "lte")},
  ${sqlNumber(input.threshold_value)},
  ${sqlString(input.severity || "warning")},
  ${sqlString(input.title || null)},
  ${sqlString(now)}
)
ON CONFLICT(bot_pk, rule_type) DO UPDATE SET
  is_enabled = excluded.is_enabled,
  comparison_operator = excluded.comparison_operator,
  threshold_value = excluded.threshold_value,
  severity = excluded.severity,
  title = excluded.title,
  updated_at = excluded.updated_at;
`;

  execSql(dbPath, sql);
}

function upsertGridProfitCaptureReadyRule(dbPath, input, now) {
  const sql = `
INSERT INTO bot_alert_rules (
  bot_pk,
  rule_type,
  is_enabled,
  severity,
  title,
  updated_at
) VALUES (
  ${sqlNumber(input.bot_pk)},
  ${sqlString(GRID_PROFIT_CAPTURE_READY_RULE)},
  ${input.is_enabled ? 1 : 0},
  ${sqlString(input.severity || "warning")},
  ${sqlString(input.title || null)},
  ${sqlString(now)}
)
ON CONFLICT(bot_pk, rule_type) DO UPDATE SET
  is_enabled = excluded.is_enabled,
  severity = excluded.severity,
  title = excluded.title,
  updated_at = excluded.updated_at;
`;

  execSql(dbPath, sql);
}

async function evaluateAlertsForSnapshot(dbPath, bot, snapshot, snapshotId) {
  const rules = queryJson(
    dbPath,
    `SELECT
       rule_pk,
       bot_pk,
       rule_type,
       is_enabled,
       comparison_operator,
       threshold_value,
       severity,
       title,
       last_triggered_at
     FROM bot_alert_rules
     WHERE bot_pk = ${sqlNumber(bot.bot_pk)}
       AND rule_type IN (${sqlString(TOTAL_PNL_THRESHOLD_RULE)}, ${sqlString(GRID_PROFIT_CAPTURE_READY_RULE)})
       AND is_enabled = 1`
  );

  for (const rule of rules) {
    if (rule.rule_type === TOTAL_PNL_THRESHOLD_RULE) {
      await evaluateTotalPnlThreshold(dbPath, bot, snapshot, snapshotId, rule);
      continue;
    }

    if (rule.rule_type === GRID_PROFIT_CAPTURE_READY_RULE) {
      await evaluateGridProfitCaptureReady(dbPath, bot, snapshot, snapshotId, rule);
    }
  }
}

async function evaluateTotalPnlThreshold(dbPath, bot, snapshot, snapshotId, rule) {
  const totalPnl = numberOrNull(snapshot.total_pnl);
  const thresholdValue = numberOrNull(rule.threshold_value);

  if (totalPnl === null || thresholdValue === null) {
    resolveAlertByDedupeKey(dbPath, buildRuleDedupeKey(rule), snapshot.snapshot_time);
    return;
  }

  const matches = compareMetric(totalPnl, thresholdValue, rule.comparison_operator);
  const dedupeKey = buildRuleDedupeKey(rule);

  if (!matches) {
    resolveAlertByDedupeKey(dbPath, dedupeKey, snapshot.snapshot_time);
    return;
  }

  const existing = queryJson(
    dbPath,
    `SELECT alert_pk
     FROM alerts
     WHERE dedupe_key = ${sqlString(dedupeKey)}
       AND status = 'open'
     LIMIT 1`
  )[0];

  if (existing) {
    execSql(
      dbPath,
      `UPDATE bot_alert_rules
       SET last_triggered_at = ${sqlString(snapshot.snapshot_time)},
           updated_at = ${sqlString(snapshot.snapshot_time)}
       WHERE rule_pk = ${sqlNumber(rule.rule_pk)}`
    );
    return;
  }

  const alertTitle =
    rule.title ||
    `PnL ${comparisonLabel(rule.comparison_operator)} ${thresholdValue} для ${bot.symbol || bot.bybit_bot_id || `bot:${bot.bot_pk}`}`;
  const alertMessage =
    `Текущий total pnl ${totalPnl}. ` +
    `Порог ${comparisonLabel(rule.comparison_operator)} ${thresholdValue}.`;

  execSql(
    dbPath,
    `INSERT INTO alerts (
       bot_pk,
       snapshot_id,
       alert_type,
       severity,
       status,
       title,
       message,
       metric_name,
       metric_value,
       threshold_value,
       comparison_operator,
       dedupe_key,
       source,
       alert_time,
       raw_payload_json
     ) VALUES (
       ${sqlNumber(bot.bot_pk)},
       ${sqlNumber(snapshotId)},
       ${sqlString(TOTAL_PNL_THRESHOLD_RULE)},
       ${sqlString(rule.severity || "warning")},
       'open',
       ${sqlString(alertTitle)},
       ${sqlString(alertMessage)},
       'total_pnl',
       ${sqlNumber(totalPnl)},
       ${sqlNumber(thresholdValue)},
       ${sqlString(rule.comparison_operator || "lte")},
       ${sqlString(dedupeKey)},
       'rule_engine',
       ${sqlString(snapshot.snapshot_time)},
       ${sqlString(
         JSON.stringify({
           bot_pk: bot.bot_pk,
           symbol: bot.symbol || null,
           total_pnl: totalPnl,
           threshold_value: thresholdValue,
           comparison_operator: rule.comparison_operator || "lte",
         })
       )}
     );`
  );

  execSql(
    dbPath,
    `UPDATE bot_alert_rules
     SET last_triggered_at = ${sqlString(snapshot.snapshot_time)},
         updated_at = ${sqlString(snapshot.snapshot_time)}
     WHERE rule_pk = ${sqlNumber(rule.rule_pk)}`
  );

  await notifyAlertStatusChange(dbPath, {
    action: "opened",
    severity: rule.severity || "warning",
    title: alertTitle,
    message: alertMessage,
    bot,
    snapshotTime: snapshot.snapshot_time,
  });
}

async function resolveAlertByDedupeKey(dbPath, dedupeKey, resolvedAt) {
  const existing = queryJson(
    dbPath,
    `SELECT
       a.alert_pk,
       a.alert_type,
       a.severity,
       a.title,
       a.message,
       a.bot_pk,
       b.bybit_bot_id,
       b.symbol
     FROM alerts a
     LEFT JOIN bots b ON b.bot_pk = a.bot_pk
     WHERE a.dedupe_key = ${sqlString(dedupeKey)}
       AND a.status = 'open'
     LIMIT 1`
  )[0];

  execSql(
    dbPath,
    `UPDATE alerts
     SET status = 'resolved',
         resolved_at = ${sqlString(resolvedAt)}
     WHERE dedupe_key = ${sqlString(dedupeKey)}
       AND status = 'open'`
  );

  if (existing) {
    await notifyAlertStatusChange(dbPath, {
      action: "resolved",
      severity: existing.severity || "warning",
      title: existing.title || "Алерт закрыт",
      message: existing.message || "",
      bot: {
        bot_pk: existing.bot_pk,
        bybit_bot_id: existing.bybit_bot_id,
        symbol: existing.symbol,
      },
      snapshotTime: resolvedAt,
    });
  }
}

async function evaluateGridProfitCaptureReady(dbPath, bot, snapshot, snapshotId, rule) {
  const totalPnl = numberOrNull(snapshot.total_pnl);
  const gridProfit = numberOrNull(snapshot.grid_profit);
  const dedupeKey = buildRuleDedupeKey(rule);

  if (totalPnl === null || gridProfit === null) {
    resolveAlertByDedupeKey(dbPath, dedupeKey, snapshot.snapshot_time);
    return;
  }

  const matches = totalPnl >= gridProfit;
  if (!matches) {
    resolveAlertByDedupeKey(dbPath, dedupeKey, snapshot.snapshot_time);
    return;
  }

  const existing = queryJson(
    dbPath,
    `SELECT alert_pk
     FROM alerts
     WHERE dedupe_key = ${sqlString(dedupeKey)}
       AND status = 'open'
     LIMIT 1`
  )[0];

  if (existing) {
    execSql(
      dbPath,
      `UPDATE bot_alert_rules
       SET last_triggered_at = ${sqlString(snapshot.snapshot_time)},
           updated_at = ${sqlString(snapshot.snapshot_time)}
       WHERE rule_pk = ${sqlNumber(rule.rule_pk)}`
    );
    return;
  }

  const profitValue = roundMetric(totalPnl);
  const alertTitle =
    rule.title ||
    `${bot.symbol || bot.bybit_bot_id || `bot:${bot.bot_pk}`}: можно забрать всю grid прибыль`;
  const alertMessage =
    `По боту ${bot.symbol || bot.bybit_bot_id || `bot:${bot.bot_pk}`} можно забрать всю grid прибыль. ` +
    `Текущий total pnl ${profitValue}, grid profit ${roundMetric(gridProfit)}.`;

  execSql(
    dbPath,
    `INSERT INTO alerts (
       bot_pk,
       snapshot_id,
       alert_type,
       severity,
       status,
       title,
       message,
       metric_name,
       metric_value,
       threshold_value,
       comparison_operator,
       dedupe_key,
       source,
       alert_time,
       raw_payload_json
     ) VALUES (
       ${sqlNumber(bot.bot_pk)},
       ${sqlNumber(snapshotId)},
       ${sqlString(GRID_PROFIT_CAPTURE_READY_RULE)},
       ${sqlString(rule.severity || "warning")},
       'open',
       ${sqlString(alertTitle)},
       ${sqlString(alertMessage)},
       'total_pnl_vs_grid_profit',
       ${sqlNumber(profitValue)},
       ${sqlNumber(roundMetric(gridProfit))},
       'gte',
       ${sqlString(dedupeKey)},
       'rule_engine',
       ${sqlString(snapshot.snapshot_time)},
       ${sqlString(
         JSON.stringify({
           bot_pk: bot.bot_pk,
           symbol: bot.symbol || null,
           total_pnl: profitValue,
           grid_profit: roundMetric(gridProfit),
         })
       )}
     );`
  );

  execSql(
    dbPath,
    `UPDATE bot_alert_rules
     SET last_triggered_at = ${sqlString(snapshot.snapshot_time)},
         updated_at = ${sqlString(snapshot.snapshot_time)}
     WHERE rule_pk = ${sqlNumber(rule.rule_pk)}`
  );

  await notifyAlertStatusChange(dbPath, {
    action: "opened",
    severity: rule.severity || "warning",
    title: alertTitle,
    message: alertMessage,
    bot,
    snapshotTime: snapshot.snapshot_time,
  });
}

function buildRuleDedupeKey(rule) {
  return `bot:${rule.bot_pk}:rule:${rule.rule_type}`;
}

function compareMetric(metricValue, thresholdValue, operator) {
  if (operator === "gte") {
    return metricValue >= thresholdValue;
  }

  return metricValue <= thresholdValue;
}

function comparisonLabel(operator) {
  return operator === "gte" ? ">=" : "<=";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMetric(value) {
  const numeric = numberOrNull(value);
  if (numeric === null) {
    return null;
  }

  return Math.round(numeric * 10000) / 10000;
}

async function notifyAlertStatusChange(dbPath, alert) {
  const settings = getJsonSetting(dbPath, TELEGRAM_ALERT_SETTINGS_KEY)?.value || {};
  const enabled = Boolean(settings.enabled);
  const botToken = typeof settings.botToken === "string" ? settings.botToken.trim() : "";
  const chatId = typeof settings.chatId === "string" ? settings.chatId.trim() : "";
  const minSeverity = normalizeSeverity(settings.minSeverity);
  const sendResolved = Boolean(settings.sendResolved);

  if (!enabled || !botToken || !chatId) {
    return false;
  }
  if (!severityPasses(alert.severity, minSeverity)) {
    return false;
  }
  if (alert.action === "resolved" && !sendResolved) {
    return false;
  }

  const statusLabel = alert.action === "resolved" ? "resolved" : "open";
  const emoji = alert.action === "resolved" ? "✅" : severityEmoji(alert.severity);
  const botLabel = [alert.bot?.symbol || alert.bot?.bybit_bot_id || "bot", alert.bot?.bybit_bot_id || ""].filter(Boolean).join(" · ");
  const text = [
    `${emoji} ${alert.title}`,
    `🤖 ${botLabel}`,
    alert.message,
    "",
    `Severity: ${alert.severity}`,
    `Status: ${statusLabel}`,
    `🕒 ${new Date(alert.snapshotTime).toLocaleString("ru-RU")}`,
  ].join("\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function normalizeSeverity(value) {
  return ["info", "warning", "critical"].includes(String(value)) ? String(value) : "warning";
}

function severityPasses(value, minSeverity) {
  return severityRank(value) >= severityRank(minSeverity);
}

function severityRank(value) {
  if (value === "critical") {
    return 3;
  }
  if (value === "warning") {
    return 2;
  }
  return 1;
}

function severityEmoji(value) {
  if (value === "critical") {
    return "🚨";
  }
  if (value === "warning") {
    return "⚠️";
  }
  return "ℹ️";
}

module.exports = {
  GRID_PROFIT_CAPTURE_READY_RULE,
  TOTAL_PNL_THRESHOLD_RULE,
  evaluateAlertsForSnapshot,
  upsertGridProfitCaptureReadyRule,
  listBotAlertRules,
  upsertTotalPnlRule,
};
