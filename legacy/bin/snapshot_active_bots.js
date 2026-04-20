#!/usr/bin/env node

const { runActiveBotSnapshotCycle } = require("../src/services/activeBotSnapshotRunner");

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const summary = await runActiveBotSnapshotCycle();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (summary.source_active_bots === 0) {
    console.log("No active bots found in local DB.");
    return;
  }

  console.log(`DB: ${summary.db_path}`);
  console.log(`Bybit env: ${summary.bybit_env}`);
  console.log(`Active bots loaded: ${summary.source_active_bots}`);
  console.log(`Snapshots inserted: ${summary.snapshots_inserted}`);
  console.log(`Snapshots skipped: ${summary.snapshots_skipped}`);
  console.log(`Detail failures: ${summary.detail_failures.length}`);
  if (summary.detail_failures.length > 0) {
    console.log(JSON.stringify(summary.detail_failures, null, 2));
  }
}
