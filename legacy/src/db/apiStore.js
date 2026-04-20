const { execSql, queryJson, sqlNumber, sqlString } = require("./sqlite");

function safeLimit(value) {
  const n = Math.max(1, Math.min(Number(value) || 100, 1000));
  return n;
}

function listBots(dbPath) {
  return queryJson(
    dbPath,
    `SELECT
       b.bot_pk,
       b.bybit_bot_id,
       b.guessed_key,
       b.identity_status,
       b.inference_confidence,
       b.inference_reason,
       COALESCE(ls.symbol, b.symbol) AS symbol,
       COALESCE(ls.bot_type, b.bot_type) AS bot_type,
       COALESCE(ls.status, b.status) AS status,
       ls.equity,
       ls.total_pnl,
       ls.total_apr,
       ls.grid_apr,
       ls.grid_profit,
       COALESCE(
         ls.leverage,
         (
           SELECT s2.leverage
           FROM bot_snapshots s2
           WHERE s2.bot_pk = b.bot_pk
             AND s2.leverage IS NOT NULL
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
       ) AS leverage,
       ls.activity_count,
       ls.investment AS analytics_investment,
       ls.create_time,
       ls.operation_time_ms,
       (
         SELECT MAX(bs.total_pnl)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = b.bot_pk
       ) AS local_peak_total_pnl,
       b.route,
       b.source,
       b.is_active,
       b.first_seen_at,
       b.last_seen_at,
       b.last_snapshot_at,
       b.confirmed_at,
       (
         SELECT COUNT(*)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = b.bot_pk
       ) AS snapshot_count,
       (
         SELECT COUNT(*)
         FROM alerts a
         WHERE a.bot_pk = b.bot_pk
           AND a.status = 'open'
       ) AS open_alert_count
     FROM bots b
     LEFT JOIN bot_snapshots ls
       ON ls.snapshot_id = (
         SELECT s.snapshot_id
         FROM bot_snapshots s
         WHERE s.bot_pk = b.bot_pk
         ORDER BY s.snapshot_time DESC, s.snapshot_id DESC
         LIMIT 1
       )
     ORDER BY b.last_seen_at DESC, b.bot_pk DESC`
  );
}

function listBotGridProfitAnchors(dbPath, botPks, startIso) {
  const normalizedBotPks = [...new Set((Array.isArray(botPks) ? botPks : []).map((value) => Number(value)).filter(Number.isInteger))];
  if (normalizedBotPks.length === 0) {
    return [];
  }

  return queryJson(
    dbPath,
    `SELECT
       b.bot_pk,
       (
         SELECT s.grid_profit
         FROM bot_snapshots s
         WHERE s.bot_pk = b.bot_pk
           AND s.grid_profit IS NOT NULL
           AND s.snapshot_time <= ${sqlString(startIso)}
         ORDER BY s.snapshot_time DESC, s.snapshot_id DESC
         LIMIT 1
       ) AS baseline_grid_profit,
       (
         SELECT s.grid_profit
         FROM bot_snapshots s
         WHERE s.bot_pk = b.bot_pk
           AND s.grid_profit IS NOT NULL
           AND s.snapshot_time >= ${sqlString(startIso)}
         ORDER BY s.snapshot_time ASC, s.snapshot_id ASC
         LIMIT 1
       ) AS first_window_grid_profit,
       (
         SELECT s.grid_profit
         FROM bot_snapshots s
         WHERE s.bot_pk = b.bot_pk
           AND s.grid_profit IS NOT NULL
         ORDER BY s.snapshot_time DESC, s.snapshot_id DESC
         LIMIT 1
       ) AS latest_grid_profit
     FROM bots b
     WHERE b.bot_pk IN (${normalizedBotPks.map((value) => sqlNumber(value)).join(", ")})`
  );
}

function getBotById(dbPath, botId) {
  const where = buildBotLookupWhere(botId);
  return queryJson(
    dbPath,
    `SELECT
       b.bot_pk,
       b.bybit_bot_id,
       b.guessed_key,
       b.identity_status,
       b.inference_confidence,
       b.inference_reason,
       b.symbol,
       b.bot_type,
       b.status,
       b.route,
       b.source,
       b.is_active,
       b.first_seen_at,
       b.last_seen_at,
       b.confirmed_at,
       b.last_snapshot_at,
       b.notes,
       b.raw_metadata_json,
       (
         SELECT MAX(bs.total_pnl)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = b.bot_pk
       ) AS local_peak_total_pnl,
       (
         SELECT COUNT(*)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = b.bot_pk
       ) AS snapshot_count,
       (
         SELECT COUNT(*)
         FROM alerts a
         WHERE a.bot_pk = b.bot_pk
           AND a.status = 'open'
       ) AS open_alert_count
     FROM bots b
     WHERE ${where}
     LIMIT 1`
  )[0] || null;
}

function getLatestBotSnapshot(dbPath, botPk) {
  return queryJson(
    dbPath,
    `SELECT
       snapshot_id,
       source,
       snapshot_time,
       symbol,
       bot_type,
       status,
       equity,
       total_pnl,
       total_apr,
       grid_apr,
       grid_profit,
       COALESCE(
         leverage,
         (
           SELECT s2.leverage
           FROM bot_snapshots s2
           WHERE s2.bot_pk = bot_snapshots.bot_pk
             AND s2.leverage IS NOT NULL
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
       ) AS leverage,
       activity_count,
       create_time,
       operation_time_ms,
       modify_time,
       end_time,
       (
         SELECT first_seen_at
         FROM bots b
         WHERE b.bot_pk = bot_snapshots.bot_pk
       ) AS first_seen_at,
       (
         SELECT confirmed_at
         FROM bots b
         WHERE b.bot_pk = bot_snapshots.bot_pk
       ) AS confirmed_at,
       (
         SELECT MAX(bs.total_pnl)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = bot_snapshots.bot_pk
       ) AS local_peak_total_pnl,
       investment,
       realized_pnl,
       unrealized_pnl,
       funding_fees,
       liquidation_price,
       total_order_balance,
       available_balance,
       position_balance,
       raw_payload_json
     FROM bot_snapshots
     WHERE bot_pk = ${sqlString(botPk)}
     ORDER BY snapshot_time DESC, snapshot_id DESC
     LIMIT 1`
  )[0] || null;
}

function getBotSnapshots(dbPath, botId, limit) {
  const where = buildBotLookupWhere(botId, "b");
  return queryJson(
    dbPath,
    `SELECT
       s.snapshot_id,
       s.bot_pk,
       b.bybit_bot_id,
       b.guessed_key,
       b.first_seen_at,
       b.confirmed_at,
       s.source,
       s.snapshot_time,
       s.symbol,
       s.bot_type,
       s.status,
       s.equity,
       s.total_pnl,
       s.total_apr,
       s.grid_apr,
       s.grid_profit,
       COALESCE(
         s.leverage,
         (
           SELECT s2.leverage
           FROM bot_snapshots s2
           WHERE s2.bot_pk = s.bot_pk
             AND s2.leverage IS NOT NULL
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
       ) AS leverage,
       s.activity_count,
       MAX(s.total_pnl) OVER (
         PARTITION BY s.bot_pk
         ORDER BY s.snapshot_time ASC, s.snapshot_id ASC
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS local_peak_total_pnl,
       s.investment,
       s.realized_pnl,
       s.unrealized_pnl,
       s.funding_fees,
       s.liquidation_price,
       s.total_order_balance,
       s.available_balance,
       s.position_balance,
       s.create_time,
       s.operation_time_ms,
       s.modify_time,
       s.end_time,
       s.raw_payload_json
     FROM bot_snapshots s
     JOIN bots b ON b.bot_pk = s.bot_pk
     WHERE ${where}
     ORDER BY s.snapshot_time DESC, s.snapshot_id DESC
     LIMIT ${safeLimit(limit)}`
  );
}

function getDashboardSummary(dbPath) {
  const rows = queryJson(
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
       (SELECT COUNT(*) FROM bots) AS total_bots,
       (SELECT COUNT(*) FROM bots WHERE is_active = 1) AS active_bots,
       (SELECT COUNT(*) FROM bots WHERE identity_status != 'confirmed') AS inferred_bots,
       (SELECT COUNT(*) FROM alerts WHERE status = 'open') AS open_alerts,
       (SELECT MAX(snapshot_time) FROM latest_snapshots) AS latest_snapshot_time,
       (SELECT COALESCE(SUM(equity), 0) FROM latest_snapshots) AS total_equity,
       (SELECT COALESCE(SUM(total_pnl), 0) FROM latest_snapshots) AS total_pnl,
       (SELECT AVG(total_apr) FROM latest_snapshots WHERE total_apr IS NOT NULL) AS average_total_apr,
       (SELECT AVG(grid_apr) FROM latest_snapshots WHERE grid_apr IS NOT NULL) AS average_grid_apr`
  );

  return rows[0] || null;
}

function getDashboardStatusBreakdown(dbPath) {
  return queryJson(
    dbPath,
    `WITH latest_snapshots AS (
       SELECT
         b.bot_pk,
         COALESCE(s.status, b.status, 'UNKNOWN') AS status
       FROM bots b
       LEFT JOIN bot_snapshots s
         ON s.snapshot_id = (
           SELECT s2.snapshot_id
           FROM bot_snapshots s2
           WHERE s2.bot_pk = b.bot_pk
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
     )
     SELECT status, COUNT(*) AS bot_count
     FROM latest_snapshots
     GROUP BY status
     ORDER BY bot_count DESC, status ASC`
  );
}

function getDashboardBotTypeBreakdown(dbPath) {
  return queryJson(
    dbPath,
    `WITH latest_snapshots AS (
       SELECT
         b.bot_pk,
         COALESCE(s.bot_type, b.bot_type, 'unknown') AS bot_type
       FROM bots b
       LEFT JOIN bot_snapshots s
         ON s.snapshot_id = (
           SELECT s2.snapshot_id
           FROM bot_snapshots s2
           WHERE s2.bot_pk = b.bot_pk
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
     )
     SELECT bot_type, COUNT(*) AS bot_count
     FROM latest_snapshots
     GROUP BY bot_type
     ORDER BY bot_count DESC, bot_type ASC`
  );
}

function listRecentAlerts(dbPath, limit) {
  return queryJson(
    dbPath,
    `SELECT
       a.alert_pk,
       a.alert_type,
       a.severity,
       a.status,
       a.title,
       a.message,
       a.metric_name,
       a.metric_value,
       a.threshold_value,
       a.comparison_operator,
       a.source,
       a.alert_time,
       a.acknowledged_at,
       a.resolved_at,
       a.bot_pk,
       b.bybit_bot_id,
       b.symbol,
       b.bot_type
     FROM alerts a
     LEFT JOIN bots b ON b.bot_pk = a.bot_pk
     ORDER BY a.alert_time DESC, a.alert_pk DESC
     LIMIT ${safeLimit(limit)}`
  );
}

function getAlertById(dbPath, alertId) {
  return (
    queryJson(
      dbPath,
      `SELECT
         a.alert_pk,
         a.alert_type,
         a.severity,
         a.status,
         a.title,
         a.message,
         a.metric_name,
         a.metric_value,
         a.threshold_value,
         a.comparison_operator,
         a.source,
         a.alert_time,
         a.acknowledged_at,
         a.resolved_at,
         a.bot_pk,
         b.bybit_bot_id,
         b.symbol,
         b.bot_type
       FROM alerts a
       LEFT JOIN bots b ON b.bot_pk = a.bot_pk
       WHERE a.alert_pk = ${sqlNumber(alertId)}
       LIMIT 1`
    )[0] || null
  );
}

function acknowledgeAlert(dbPath, alertId, now) {
  execSql(
    dbPath,
    `UPDATE alerts
     SET status = CASE WHEN status = 'open' THEN 'acknowledged' ELSE status END,
         acknowledged_at = CASE WHEN status = 'open' THEN ${sqlString(now)} ELSE acknowledged_at END
     WHERE alert_pk = ${sqlNumber(alertId)}`
  );
}

function suppressAlert(dbPath, alertId, now) {
  const alert = getAlertById(dbPath, alertId);
  if (!alert) {
    return null;
  }

  execSql(
    dbPath,
    `UPDATE alerts
     SET status = 'suppressed',
         resolved_at = COALESCE(resolved_at, ${sqlString(now)})
     WHERE alert_pk = ${sqlNumber(alertId)}`
  );

  if (alert.bot_pk && alert.alert_type) {
    execSql(
      dbPath,
      `UPDATE bot_alert_rules
       SET is_enabled = 0,
           updated_at = ${sqlString(now)}
       WHERE bot_pk = ${sqlNumber(alert.bot_pk)}
         AND rule_type = ${sqlString(alert.alert_type)}`
    );
  }

  return alert;
}

function getHealthSummary(dbPath) {
  const rows = queryJson(
    dbPath,
    `SELECT
       (SELECT COUNT(*) FROM bots) AS total_bots,
       (SELECT COUNT(*) FROM bot_snapshots) AS total_snapshots,
       (SELECT COUNT(*) FROM alerts WHERE status = 'open') AS open_alerts,
       (SELECT MAX(snapshot_time) FROM bot_snapshots) AS latest_snapshot_time`
  );

  return rows[0] || null;
}

function getServiceStatus(dbPath, serviceName) {
  const rows = queryJson(
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
  );

  return rows[0] || null;
}

function getApiMetrics(dbPath) {
  const rows = queryJson(
    dbPath,
    `SELECT
       (SELECT COUNT(*) FROM bots) AS total_bots,
       (SELECT COUNT(*) FROM bots WHERE is_active = 1) AS active_bots,
       (SELECT COUNT(*) FROM bots WHERE identity_status != 'confirmed') AS inferred_bots,
       (SELECT COUNT(*) FROM bot_snapshots) AS total_snapshots,
       (SELECT COUNT(*) FROM bot_snapshots WHERE snapshot_time >= datetime('now', '-24 hours')) AS snapshots_last_24h,
       (SELECT COUNT(*) FROM alerts) AS total_alerts,
       (SELECT COUNT(*) FROM alerts WHERE status = 'open') AS open_alerts,
       (SELECT COUNT(*) FROM alerts WHERE severity = 'critical' AND status = 'open') AS critical_open_alerts,
       (SELECT COUNT(*) FROM orders) AS total_orders,
       (SELECT COUNT(*) FROM executions) AS total_executions,
       (SELECT MAX(snapshot_time) FROM bot_snapshots) AS latest_snapshot_time`
  );

  return rows[0] || null;
}

function getCurrentPlan(dbPath) {
  return (
    queryJson(
      dbPath,
      `SELECT
         plan_pk,
         title,
         target_daily_pnl_usd,
         status,
         notes,
         created_at,
         updated_at
       FROM plans
       WHERE is_current = 1
       ORDER BY plan_pk DESC
       LIMIT 1`
    )[0] || null
  );
}

function listCurrentPlanBots(dbPath, planPk) {
  return queryJson(
    dbPath,
    `SELECT
       b.bot_pk,
       b.bybit_bot_id,
       b.is_active,
       COALESCE(ls.symbol, b.symbol) AS symbol,
       COALESCE(ls.bot_type, b.bot_type) AS bot_type,
       COALESCE(ls.status, b.status) AS status,
       ls.equity,
       ls.total_pnl,
       ls.total_apr,
       ls.grid_apr,
       ls.grid_profit,
       COALESCE(
         ls.leverage,
         (
           SELECT s2.leverage
           FROM bot_snapshots s2
           WHERE s2.bot_pk = b.bot_pk
             AND s2.leverage IS NOT NULL
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
       ) AS leverage,
       ls.activity_count,
       ls.investment AS analytics_investment,
       ls.create_time,
       ls.operation_time_ms,
       (
         SELECT MAX(bs.total_pnl)
         FROM bot_snapshots bs
         WHERE bs.bot_pk = b.bot_pk
       ) AS local_peak_total_pnl,
       b.first_seen_at,
       b.last_seen_at,
       b.last_snapshot_at,
       b.confirmed_at,
       COALESCE(pb.is_included, 0) AS is_included,
       COALESCE(pb.weight, 1) AS weight,
       pb.updated_at AS membership_updated_at,
       COALESCE(se.exclude_from_plan, 0) AS exclude_from_plan,
       COALESCE(se.exclude_from_period_stats, 0) AS exclude_from_period_stats,
       se.exclude_reason,
       se.exclude_note
     FROM bots b
     LEFT JOIN plan_bots pb
       ON pb.bot_pk = b.bot_pk
      AND pb.plan_pk = ${sqlNumber(planPk)}
     LEFT JOIN stats_exclusions se
       ON se.bot_pk = b.bot_pk
      AND se.closed_run_pk IS NULL
     LEFT JOIN bot_snapshots ls
       ON ls.snapshot_id = (
         SELECT s.snapshot_id
         FROM bot_snapshots s
         WHERE s.bot_pk = b.bot_pk
         ORDER BY s.snapshot_time DESC, s.snapshot_id DESC
         LIMIT 1
       )
     ORDER BY b.is_active DESC,
              COALESCE(pb.is_included, 0) DESC,
              COALESCE(ls.grid_profit, -999999) DESC,
              COALESCE(ls.total_pnl, -999999) DESC,
              b.bot_pk ASC`
  );
}

function listCurrentPlanSnapshots(dbPath, planPk) {
  return queryJson(
    dbPath,
    `SELECT
       pb.bot_pk,
       bs.snapshot_time,
       bs.grid_profit,
       bs.total_pnl,
       bs.equity
     FROM plan_bots pb
     JOIN bot_snapshots bs ON bs.bot_pk = pb.bot_pk
     WHERE pb.plan_pk = ${sqlNumber(planPk)}
       AND pb.is_included = 1
     ORDER BY bs.snapshot_time ASC, bs.snapshot_id ASC`
  );
}

function getClosedBotRunsSummary(dbPath) {
  return (
    queryJson(
      dbPath,
      `SELECT
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN 1
           ELSE 0
         END) AS closed_bots_count,
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN COALESCE(total_pnl, realized_pnl)
           ELSE 0
         END) AS total_final_pnl,
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND realized_pnl IS NOT NULL THEN realized_pnl
           ELSE 0
         END) AS total_realized_pnl,
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND COALESCE(total_pnl, realized_pnl) > 0 THEN 1
           ELSE 0
         END) AS profitable_closed_bots,
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND COALESCE(total_pnl, realized_pnl) < 0 THEN 1
           ELSE 0
         END) AS losing_closed_bots,
         (
           SUM(CASE
             WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
              AND COALESCE(total_pnl, realized_pnl) IS NOT NULL
              AND investment IS NOT NULL
              AND investment > 0
               THEN COALESCE(total_pnl, realized_pnl)
             ELSE 0
           END) * 100.0
         ) / NULLIF(SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND COALESCE(total_pnl, realized_pnl) IS NOT NULL
            AND investment IS NOT NULL
            AND investment > 0
             THEN investment
           ELSE 0
         END), 0) AS avg_pnl_per_100_usd,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND COALESCE(total_pnl, realized_pnl) IS NOT NULL
            AND lifetime_days IS NOT NULL
            AND lifetime_days > 0
             THEN COALESCE(total_pnl, realized_pnl) / lifetime_days
           ELSE NULL
         END) AS avg_pnl_per_day,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN lifetime_days
           ELSE NULL
         END) AS avg_lifetime_days,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND realized_pnl IS NOT NULL THEN 1.0
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN 0.0
           ELSE NULL
         END) AS realized_pnl_coverage_ratio,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND lifetime_days IS NOT NULL THEN 1.0
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN 0.0
           ELSE NULL
         END) AS lifetime_coverage_ratio,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND close_reason IS NOT NULL AND close_reason <> '' THEN 1.0
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN 0.0
           ELSE NULL
         END) AS close_reason_coverage_ratio,
         AVG(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0
            AND strategy_tag IS NOT NULL AND strategy_tag <> '' THEN 1.0
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 0 THEN 0.0
           ELSE NULL
         END) AS strategy_tag_coverage_ratio,
         SUM(CASE
           WHEN COALESCE(se.exclude_from_closed_stats, 0) = 1 THEN 1
           ELSE 0
         END) AS excluded_runs_count
       FROM closed_bot_runs c
       LEFT JOIN stats_exclusions se
         ON se.closed_run_pk = c.closed_run_pk
        AND se.bot_pk IS NULL`
    )[0] || null
  );
}

function listClosedBotRuns(dbPath, limit = 100) {
  return queryJson(
    dbPath,
    `SELECT
       c.closed_run_pk,
       c.legacy_bot_id,
       c.bot_pk,
       c.symbol,
       c.bot_type,
       c.strategy_tag,
       c.close_reason,
       c.close_reason_detail,
       c.started_at,
       c.closed_at,
       c.first_observed_at,
       c.last_observed_at,
       c.snapshot_count,
       c.investment,
       c.realized_pnl,
       c.unrealized_pnl,
       c.total_pnl,
       c.equity_at_close,
       c.leverage,
       c.lifetime_days,
       c.source,
       COALESCE(se.exclude_from_period_stats, 0) AS exclude_from_period_stats,
       COALESCE(se.exclude_from_closed_stats, 0) AS exclude_from_closed_stats,
       se.exclude_reason,
       se.exclude_note,
       c.raw_metadata_json,
       c.created_at,
       c.updated_at
     FROM closed_bot_runs c
     LEFT JOIN stats_exclusions se
       ON se.closed_run_pk = c.closed_run_pk
      AND se.bot_pk IS NULL
     ORDER BY COALESCE(c.closed_at, c.last_observed_at, c.updated_at) DESC, c.closed_run_pk DESC
     LIMIT ${sqlNumber(limit)}`
  );
}

function getClosedBotRunByPk(dbPath, closedRunPk) {
  return (
    queryJson(
      dbPath,
      `SELECT
         closed_run_pk,
         legacy_bot_id,
         bot_pk,
         symbol,
         bot_type
       FROM closed_bot_runs
       WHERE closed_run_pk = ${sqlNumber(closedRunPk)}
       LIMIT 1`
    )[0] || null
  );
}

function getPeriodSummaryBounds(dbPath) {
  return (
    queryJson(
      dbPath,
      `SELECT
         (SELECT MIN(bs.snapshot_time)
          FROM bot_snapshots bs
          JOIN bots b ON b.bot_pk = bs.bot_pk
          WHERE b.is_active = 1) AS active_min_snapshot_time,
         (SELECT MAX(bs.snapshot_time)
          FROM bot_snapshots bs
          JOIN bots b ON b.bot_pk = bs.bot_pk
          WHERE b.is_active = 1) AS active_max_snapshot_time,
         (SELECT MIN(COALESCE(c.closed_at, c.last_observed_at, c.updated_at))
          FROM closed_bot_runs c) AS closed_min_time,
         (SELECT MAX(COALESCE(c.closed_at, c.last_observed_at, c.updated_at))
          FROM closed_bot_runs c) AS closed_max_time`
    )[0] || null
  );
}

function listActiveBotSnapshotsForPeriodSummary(dbPath, startTime = null) {
  const periodFilter = startTime ? `AND bs.snapshot_time >= ${sqlString(startTime)}` : "";

  return queryJson(
    dbPath,
    `SELECT
       bs.bot_pk,
       b.bybit_bot_id,
       COALESCE(bs.symbol, b.symbol) AS symbol,
       COALESCE(bs.bot_type, b.bot_type) AS bot_type,
       bs.snapshot_time,
       bs.total_pnl,
       bs.realized_pnl,
       bs.equity,
       COALESCE(
         bs.leverage,
         (
           SELECT s2.leverage
           FROM bot_snapshots s2
           WHERE s2.bot_pk = bs.bot_pk
             AND s2.leverage IS NOT NULL
           ORDER BY s2.snapshot_time DESC, s2.snapshot_id DESC
           LIMIT 1
         )
       ) AS leverage,
       COALESCE(se.exclude_from_plan, 0) AS exclude_from_plan,
       COALESCE(se.exclude_from_period_stats, 0) AS exclude_from_period_stats,
       se.exclude_reason,
       se.exclude_note
     FROM bot_snapshots bs
     JOIN bots b ON b.bot_pk = bs.bot_pk
     LEFT JOIN stats_exclusions se
       ON se.bot_pk = b.bot_pk
      AND se.closed_run_pk IS NULL
     WHERE b.is_active = 1
       ${periodFilter}
     ORDER BY bs.bot_pk ASC, bs.snapshot_time ASC, bs.snapshot_id ASC`
  );
}

function listClosedBotRunsForPeriodSummary(dbPath, startTime = null) {
  const periodFilter = startTime
    ? `WHERE COALESCE(c.closed_at, c.last_observed_at, c.updated_at) >= ${sqlString(startTime)}`
    : "";

  return queryJson(
    dbPath,
    `SELECT
       c.closed_run_pk,
       c.legacy_bot_id,
       c.bot_pk,
       c.symbol,
       c.bot_type,
       c.strategy_tag,
       c.close_reason,
       c.started_at,
       c.closed_at,
       c.first_observed_at,
       c.last_observed_at,
       c.snapshot_count,
       c.realized_pnl,
       c.total_pnl,
       c.equity_at_close,
       c.leverage,
       c.lifetime_days,
       c.source,
       COALESCE(se.exclude_from_period_stats, 0) AS exclude_from_period_stats,
       COALESCE(se.exclude_from_closed_stats, 0) AS exclude_from_closed_stats,
       se.exclude_reason,
       se.exclude_note
     FROM closed_bot_runs c
     LEFT JOIN stats_exclusions se
       ON se.closed_run_pk = c.closed_run_pk
      AND se.bot_pk IS NULL
     ${periodFilter}
     ORDER BY COALESCE(c.closed_at, c.last_observed_at, c.updated_at) DESC, c.closed_run_pk DESC`
  );
}

function buildBotLookupWhere(botId, tableAlias = "b") {
  const numericBotPk = Number(botId);
  const conditions = [`${tableAlias}.bybit_bot_id = ${sqlString(botId)}`];

  if (Number.isInteger(numericBotPk) && String(numericBotPk) === String(botId)) {
    conditions.push(`${tableAlias}.bot_pk = ${numericBotPk}`);
  }

  return `(${conditions.join(" OR ")})`;
}

module.exports = {
  acknowledgeAlert,
  getCurrentPlan,
  getAlertById,
  getBotById,
  getBotSnapshots,
  getHealthSummary,
  getApiMetrics,
  getPeriodSummaryBounds,
  getServiceStatus,
  getDashboardBotTypeBreakdown,
  getDashboardStatusBreakdown,
  getDashboardSummary,
  getLatestBotSnapshot,
  getClosedBotRunByPk,
  getClosedBotRunsSummary,
  listActiveBotSnapshotsForPeriodSummary,
  listCurrentPlanSnapshots,
  listCurrentPlanBots,
  listClosedBotRunsForPeriodSummary,
  listClosedBotRuns,
  listBots,
  listBotGridProfitAnchors,
  listRecentAlerts,
  suppressAlert,
};
