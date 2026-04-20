PRAGMA foreign_keys = ON;

BEGIN;

-- Canonical bot registry. One row may represent a confirmed Bybit bot
-- or a guessed/inferred bot candidate when `bybit_bot_id` is still unknown.
CREATE TABLE IF NOT EXISTS bots (
  bot_pk INTEGER PRIMARY KEY,
  bybit_bot_id TEXT,
  guessed_key TEXT,
  identity_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (identity_status IN ('confirmed', 'guessed', 'inferred', 'unknown')),
  inference_confidence REAL
    CHECK (inference_confidence IS NULL OR (inference_confidence >= 0 AND inference_confidence <= 1)),
  inference_reason TEXT,
  symbol TEXT,
  bot_type TEXT NOT NULL DEFAULT 'unknown',
  status TEXT,
  route TEXT,
  source TEXT NOT NULL DEFAULT 'unknown',
  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  last_snapshot_at TEXT,
  notes TEXT,
  raw_metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bots_bybit_bot_id
  ON bots (bybit_bot_id)
  WHERE bybit_bot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bots_guessed_key
  ON bots (guessed_key)
  WHERE guessed_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bots_symbol_type_status
  ON bots (symbol, bot_type, status);

CREATE INDEX IF NOT EXISTS idx_bots_identity_status
  ON bots (identity_status, inference_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_bots_last_seen_at
  ON bots (last_seen_at DESC);

-- Point-in-time bot metrics snapshots from Bybit API, inferred data, or local reconciliation.
CREATE TABLE IF NOT EXISTS bot_snapshots (
  snapshot_id INTEGER PRIMARY KEY,
  bot_pk INTEGER NOT NULL REFERENCES bots (bot_pk) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'unknown',
  snapshot_time TEXT NOT NULL,
  symbol TEXT,
  bot_type TEXT,
  status TEXT,
  equity NUMERIC,
  total_pnl NUMERIC,
  total_apr NUMERIC,
  grid_apr NUMERIC,
  grid_profit NUMERIC,
  leverage NUMERIC,
  activity_count INTEGER,
  investment NUMERIC,
  realized_pnl NUMERIC,
  unrealized_pnl NUMERIC,
  funding_fees NUMERIC,
  liquidation_price NUMERIC,
  total_order_balance NUMERIC,
  available_balance NUMERIC,
  position_balance NUMERIC,
  create_time TEXT,
  operation_time_ms INTEGER,
  modify_time TEXT,
  end_time TEXT,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bot_pk, source, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_bot_snapshots_bot_time
  ON bot_snapshots (bot_pk, snapshot_time DESC);

CREATE INDEX IF NOT EXISTS idx_bot_snapshots_symbol_time
  ON bot_snapshots (symbol, snapshot_time DESC);

CREATE INDEX IF NOT EXISTS idx_bot_snapshots_status_time
  ON bot_snapshots (status, snapshot_time DESC);

-- Exchange orders, including records that are only tentatively matched to a bot.
CREATE TABLE IF NOT EXISTS orders (
  order_pk INTEGER PRIMARY KEY,
  bybit_order_id TEXT,
  order_link_id TEXT,
  bot_pk INTEGER REFERENCES bots (bot_pk) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  category TEXT,
  side TEXT,
  order_type TEXT,
  time_in_force TEXT,
  status TEXT,
  qty NUMERIC,
  price NUMERIC,
  avg_price NUMERIC,
  trigger_price NUMERIC,
  trigger_by TEXT,
  reduce_only INTEGER NOT NULL DEFAULT 0
    CHECK (reduce_only IN (0, 1)),
  close_on_trigger INTEGER NOT NULL DEFAULT 0
    CHECK (close_on_trigger IN (0, 1)),
  position_idx INTEGER,
  created_by TEXT,
  entry_origin TEXT NOT NULL DEFAULT 'unknown'
    CHECK (entry_origin IN ('manual', 'bot', 'inferred', 'unknown')),
  strategy_tag TEXT,
  is_bot_suspected INTEGER NOT NULL DEFAULT 0
    CHECK (is_bot_suspected IN (0, 1)),
  bot_match_confidence REAL
    CHECK (bot_match_confidence IS NULL OR (bot_match_confidence >= 0 AND bot_match_confidence <= 1)),
  bot_match_reason TEXT,
  created_at_exchange TEXT,
  updated_at_exchange TEXT,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_bybit_order_id
  ON orders (bybit_order_id)
  WHERE bybit_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_bot_time
  ON orders (bot_pk, created_at_exchange DESC);

CREATE INDEX IF NOT EXISTS idx_orders_symbol_time
  ON orders (symbol, created_at_exchange DESC);

CREATE INDEX IF NOT EXISTS idx_orders_order_link_id
  ON orders (order_link_id);

CREATE INDEX IF NOT EXISTS idx_orders_entry_origin_time
  ON orders (entry_origin, created_at_exchange DESC);

CREATE INDEX IF NOT EXISTS idx_orders_bot_suspected_time
  ON orders (is_bot_suspected, created_at_exchange DESC);

-- Trade executions/fills. These help reconcile bot activity vs manual fills.
CREATE TABLE IF NOT EXISTS executions (
  execution_pk INTEGER PRIMARY KEY,
  bybit_exec_id TEXT,
  bybit_order_id TEXT,
  order_pk INTEGER REFERENCES orders (order_pk) ON DELETE SET NULL,
  bot_pk INTEGER REFERENCES bots (bot_pk) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT,
  exec_type TEXT,
  order_type TEXT,
  qty NUMERIC,
  price NUMERIC,
  exec_value NUMERIC,
  fee NUMERIC,
  fee_currency TEXT,
  is_maker INTEGER
    CHECK (is_maker IS NULL OR is_maker IN (0, 1)),
  closed_pnl NUMERIC,
  position_idx INTEGER,
  created_by TEXT,
  entry_origin TEXT NOT NULL DEFAULT 'unknown'
    CHECK (entry_origin IN ('manual', 'bot', 'inferred', 'unknown')),
  is_bot_suspected INTEGER NOT NULL DEFAULT 0
    CHECK (is_bot_suspected IN (0, 1)),
  bot_match_confidence REAL
    CHECK (bot_match_confidence IS NULL OR (bot_match_confidence >= 0 AND bot_match_confidence <= 1)),
  bot_match_reason TEXT,
  exec_time TEXT NOT NULL,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_bybit_exec_id
  ON executions (bybit_exec_id)
  WHERE bybit_exec_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_executions_bot_time
  ON executions (bot_pk, exec_time DESC);

CREATE INDEX IF NOT EXISTS idx_executions_order_time
  ON executions (order_pk, exec_time DESC);

CREATE INDEX IF NOT EXISTS idx_executions_symbol_time
  ON executions (symbol, exec_time DESC);

CREATE INDEX IF NOT EXISTS idx_executions_entry_origin_time
  ON executions (entry_origin, exec_time DESC);

-- Alert/event stream for bot health, mismatches, risk limits, or anomalous activity.
CREATE TABLE IF NOT EXISTS alerts (
  alert_pk INTEGER PRIMARY KEY,
  bot_pk INTEGER REFERENCES bots (bot_pk) ON DELETE SET NULL,
  snapshot_id INTEGER REFERENCES bot_snapshots (snapshot_id) ON DELETE SET NULL,
  order_pk INTEGER REFERENCES orders (order_pk) ON DELETE SET NULL,
  execution_pk INTEGER REFERENCES executions (execution_pk) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'suppressed')),
  title TEXT NOT NULL,
  message TEXT,
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  comparison_operator TEXT,
  dedupe_key TEXT,
  source TEXT NOT NULL DEFAULT 'rule_engine',
  alert_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TEXT,
  resolved_at TEXT,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_severity_time
  ON alerts (status, severity, alert_time DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_bot_time
  ON alerts (bot_pk, alert_time DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_metric_time
  ON alerts (metric_name, alert_time DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_open_dedupe
  ON alerts (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status = 'open';

CREATE TABLE IF NOT EXISTS service_status (
  service_name TEXT PRIMARY KEY,
  status TEXT NOT NULL
    CHECK (status IN ('idle', 'running', 'ok', 'error', 'stopped')),
  last_started_at TEXT,
  last_finished_at TEXT,
  last_success_at TEXT,
  last_error_at TEXT,
  last_error_message TEXT,
  last_snapshot_time TEXT,
  last_active_bots INTEGER,
  last_snapshots_inserted INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_alert_rules (
  rule_pk INTEGER PRIMARY KEY,
  bot_pk INTEGER NOT NULL REFERENCES bots (bot_pk) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (is_enabled IN (0, 1)),
  comparison_operator TEXT NOT NULL DEFAULT 'lte'
    CHECK (comparison_operator IN ('lte', 'gte')),
  threshold_value NUMERIC,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT,
  params_json TEXT,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bot_pk, rule_type)
);

CREATE INDEX IF NOT EXISTS idx_bot_alert_rules_bot_type
  ON bot_alert_rules (bot_pk, rule_type);

CREATE TABLE IF NOT EXISTS plans (
  plan_pk INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  target_daily_pnl_usd NUMERIC NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),
  notes TEXT,
  is_current INTEGER NOT NULL DEFAULT 1
    CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_single_current
  ON plans (is_current)
  WHERE is_current = 1;

CREATE TABLE IF NOT EXISTS plan_bots (
  plan_bot_pk INTEGER PRIMARY KEY,
  plan_pk INTEGER NOT NULL REFERENCES plans (plan_pk) ON DELETE CASCADE,
  bot_pk INTEGER NOT NULL REFERENCES bots (bot_pk) ON DELETE CASCADE,
  is_included INTEGER NOT NULL DEFAULT 0
    CHECK (is_included IN (0, 1)),
  weight REAL NOT NULL DEFAULT 1
    CHECK (weight >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (plan_pk, bot_pk)
);

CREATE INDEX IF NOT EXISTS idx_plan_bots_plan_included
  ON plan_bots (plan_pk, is_included);

CREATE TABLE IF NOT EXISTS closed_bot_runs (
  closed_run_pk INTEGER PRIMARY KEY,
  legacy_bot_id TEXT NOT NULL,
  bot_pk INTEGER REFERENCES bots (bot_pk) ON DELETE SET NULL,
  symbol TEXT,
  bot_type TEXT NOT NULL DEFAULT 'futures_grid',
  strategy_tag TEXT,
  close_reason TEXT,
  close_reason_detail TEXT,
  started_at TEXT,
  closed_at TEXT,
  first_observed_at TEXT,
  last_observed_at TEXT,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  investment NUMERIC,
  realized_pnl NUMERIC,
  unrealized_pnl NUMERIC,
  total_pnl NUMERIC,
  equity_at_close NUMERIC,
  lifetime_days NUMERIC,
  source TEXT NOT NULL DEFAULT 'completed_fgrid_history',
  raw_metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (legacy_bot_id)
);

CREATE INDEX IF NOT EXISTS idx_closed_bot_runs_closed_at
  ON closed_bot_runs (closed_at DESC);

CREATE INDEX IF NOT EXISTS idx_closed_bot_runs_close_reason
  ON closed_bot_runs (close_reason);

CREATE INDEX IF NOT EXISTS idx_closed_bot_runs_strategy_tag
  ON closed_bot_runs (strategy_tag);

CREATE TABLE IF NOT EXISTS stats_exclusions (
  exclusion_pk INTEGER PRIMARY KEY,
  bot_pk INTEGER REFERENCES bots (bot_pk) ON DELETE CASCADE,
  closed_run_pk INTEGER REFERENCES closed_bot_runs (closed_run_pk) ON DELETE CASCADE,
  exclude_from_plan INTEGER NOT NULL DEFAULT 0
    CHECK (exclude_from_plan IN (0, 1)),
  exclude_from_period_stats INTEGER NOT NULL DEFAULT 0
    CHECK (exclude_from_period_stats IN (0, 1)),
  exclude_from_closed_stats INTEGER NOT NULL DEFAULT 0
    CHECK (exclude_from_closed_stats IN (0, 1)),
  exclude_reason TEXT
    CHECK (exclude_reason IS NULL OR exclude_reason IN (
      'experiment',
      'technical',
      'duplicate',
      'invalid_data',
      'manual_ignore',
      'migration',
      'other'
    )),
  exclude_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (bot_pk IS NOT NULL AND closed_run_pk IS NULL) OR
    (bot_pk IS NULL AND closed_run_pk IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_exclusions_bot
  ON stats_exclusions (bot_pk)
  WHERE bot_pk IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_exclusions_closed_run
  ON stats_exclusions (closed_run_pk)
  WHERE closed_run_pk IS NOT NULL;

COMMIT;
