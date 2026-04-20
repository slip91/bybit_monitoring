function formatRefreshSummary(summary) {
  const lines = [
    `DB: ${summary.db_path}`,
    `Bybit env: ${summary.bybit_env}`,
    `Inventory loaded from DB: ${summary.db_inventory_loaded}`,
    `Browser list attempted: ${summary.browser_list_attempted ? "yes" : "no"}`,
    `Browser list ok: ${summary.browser_list_ok ? "yes" : "no"}`,
    `Browser-discovered bots: ${summary.browser_discovered}`,
    `History-discovered bots: ${summary.history_discovered}`,
    `Futures grid refreshed: ${summary.futures_grid_refreshed}`,
    `Running futures grid bots: ${summary.running_futures_grid}`,
    `Completed futures grid bots: ${summary.completed_futures_grid}`,
    `Completed snapshots inserted: ${summary.snapshots_inserted}`,
  ];

  if (summary.browser_schema) {
    lines.push(`Browser schema: ${JSON.stringify(summary.browser_schema)}`);
  }
  if (summary.detail_failures.length > 0) {
    lines.push(`Detail failures: ${JSON.stringify(summary.detail_failures)}`);
  }

  return lines.join("\n");
}

function createActiveBotsJsonReport(bybitEnv, rows) {
  return {
    bybit_env: bybitEnv,
    bots: rows,
  };
}

function formatActiveBotsTitle(bybitEnv) {
  return `[${bybitEnv.toUpperCase()}] Active bots from local DB`;
}

function getActiveBotsNote() {
  return "Note: Bybit fgridbot/detail exposes arbitrage_num and total_order_balance, but not a dedicated open-order count.";
}

module.exports = {
  createActiveBotsJsonReport,
  formatActiveBotsTitle,
  formatRefreshSummary,
  getActiveBotsNote,
};
