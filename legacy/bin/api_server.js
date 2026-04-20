#!/usr/bin/env node

const { createApiServer } = require("../src/api/server");
const { getRuntimeConfig } = require("../src/config/runtime");

const HOST = process.env.BOT_API_HOST || "127.0.0.1";
const PORT = Number(process.env.BOT_API_PORT || 3000);

let server = null;
let shuttingDown = false;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const config = getRuntimeConfig();
  server = createApiServer({ config });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, HOST, resolve);
  });

  console.log(`Bot API listening on http://${HOST}:${PORT}`);
  console.log(`DB: ${config.dbPath}`);

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Shutdown requested: ${signal}`);

  if (!server) {
    process.exit(0);
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  console.log("Bot API stopped");
  process.exit(0);
}
