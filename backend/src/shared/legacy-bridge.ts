import path from "node:path";

const rootDir = path.resolve(__dirname, "..", "..", "..");

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const apiStore = require(path.join(rootDir, "legacy", "src", "db", "apiStore.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const warehouse = require(path.join(rootDir, "legacy", "src", "db", "warehouse.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const dto = require(path.join(rootDir, "legacy", "src", "api", "dto.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const metrics = require(path.join(rootDir, "legacy", "src", "metrics", "fgrid.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const rules = require(path.join(rootDir, "legacy", "src", "alerts", "rules.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const runtime = require(path.join(rootDir, "legacy", "src", "config", "runtime.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const bybitApi = require(path.join(rootDir, "legacy", "src", "bybit", "api.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const snapshotRunner = require(path.join(rootDir, "legacy", "src", "services", "activeBotSnapshotRunner.js"));
