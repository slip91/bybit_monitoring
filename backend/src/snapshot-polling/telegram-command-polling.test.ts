import assert from "node:assert/strict";
import test from "node:test";

import { buildStatusMessage } from "./telegram-command-polling";

test("buildStatusMessage renders current active bots with today fact", () => {
  const dbPath = "/Users/ovz/Documents/project/bybit-bots/db/bybit-bots.sqlite";
  const text = buildStatusMessage(dbPath);

  assert.match(text, /Активные боты:/);
  assert.match(text, /SOLUSDT x3/);
  assert.match(text, /XRPUSDT x2/);
  assert.match(text, /📆 Сегодня: \+/);
  assert.match(text, /\/status, \/bots, \/help/);
});
