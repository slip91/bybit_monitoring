import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ensureWarehouseSchema, insertBotSnapshot, upsertBotRecord } = require("../../../legacy/src/db/warehouse.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildBotClosureMessage,
  detectBotClosure,
  buildTradeActivityMessage,
  computeCurrentDayProfit,
  detectTradeActivity,
} = require("../../../legacy/src/services/telegramTradeNotifications.js");

test("detects new trade activity when activity_count increases", () => {
  const event = detectTradeActivity(
    {
      snapshot_time: "2026-03-28T11:00:00.000Z",
      activity_count: 27,
      grid_profit: 1.15,
      funding_fees: -0.4,
      realized_pnl: -1.2,
      total_pnl: -2.4,
    },
    {
      snapshot_time: "2026-03-28T11:05:00.000Z",
      activity_count: 29,
      grid_profit: 1.44,
      funding_fees: -0.46,
      realized_pnl: -0.9,
      total_pnl: -2.2,
    },
  );

  assert.deepEqual(event, {
    previousSnapshotTime: "2026-03-28T11:00:00.000Z",
    currentSnapshotTime: "2026-03-28T11:05:00.000Z",
    activityCountDelta: 2,
    gridProfitDelta: 0.29,
    fundingFeesDelta: -0.06,
    realizedPnlDelta: 0.3,
  });
});

test("does not trigger on pure total pnl drift without trade signal", () => {
  const event = detectTradeActivity(
    {
      snapshot_time: "2026-03-28T11:00:00.000Z",
      activity_count: 27,
      grid_profit: 1.15,
      funding_fees: -0.4,
      realized_pnl: -1.2,
      total_pnl: -2.4,
    },
    {
      snapshot_time: "2026-03-28T11:05:00.000Z",
      activity_count: 27,
      grid_profit: 1.15,
      funding_fees: -0.4,
      realized_pnl: -1.2,
      total_pnl: -3.1,
    },
  );

  assert.equal(event, null);
});

test("does not trigger on pure realized pnl drift without trade signal", () => {
  const event = detectTradeActivity(
    {
      snapshot_time: "2026-03-29T13:03:46.992Z",
      activity_count: 36,
      grid_profit: 1.47,
      funding_fees: -0.13,
      realized_pnl: -1.81,
      total_pnl: -2.91,
    },
    {
      snapshot_time: "2026-03-29T13:08:48.173Z",
      activity_count: 36,
      grid_profit: 1.47,
      funding_fees: -0.13,
      realized_pnl: -1.82,
      total_pnl: -3.71,
    },
  );

  assert.equal(event, null);
});

test("builds compact telegram message for trade activity", () => {
  const text = buildTradeActivityMessage(
    {
      symbol: "SOLUSDT",
      bybit_bot_id: "bot-1",
      leverage: 3,
    },
    {
      equity: 241.48,
      current_day_profit: 0.43,
      grid_profit: 1.44,
      operation_time_ms: 167299000,
      total_pnl: -2.2,
    },
    {
      activityCountDelta: 2,
      gridProfitDelta: 0.29,
      fundingFeesDelta: -0.06,
      realizedPnlDelta: 0.3,
      currentSnapshotTime: "2026-03-28T11:05:00.000Z",
    },
  );

  assert.match(text, /🔔 Сделок \+2, итог 🟢 \+0.29\$/);
  assert.match(text, /🤖 SOLUSDT x3/);
  assert.match(text, /🤖 SOLUSDT x3\n📆 Прибыль за день: \+0.43\$\n📈 Grid Δ: 🟢 \+0.29\$\n✨ Прибыль за сделку: \+0.14/);
  assert.match(text, /📆 Прибыль за день: \+0.43\$/);
  assert.match(text, /📈 Grid Δ: 🟢 \+0.29\$/);
  assert.match(text, /✨ Прибыль за сделку: \+0.14/);
  assert.match(text, /🎯 Сделок: \+2/);
  assert.match(text, /📊 Текущий grid: \+1.44/);
  assert.match(text, /💼 Баланс: \$241.48/);
  assert.match(text, /🧾 Текущий total: -2.20/);
  assert.match(text, /🧮 Realized Δ: 🟢 \+0.30\$/);
  assert.match(text, /💸 Funding Δ: 🔴 -0.06\$/);
  assert.match(text, /\n\n🕒 28.03.2026, 15:05:00/);
});

test("omits profit per trade line when grid delta is absent and keeps realized delta", () => {
  const text = buildTradeActivityMessage(
    {
      symbol: "XRPUSDT",
      bybit_bot_id: "bot-2",
      leverage: 3,
    },
    {
      equity: 42.2,
      current_day_profit: 0,
      grid_profit: 2.26,
      total_pnl: -28.74,
    },
    {
      activityCountDelta: 1,
      gridProfitDelta: null,
      fundingFeesDelta: null,
      realizedPnlDelta: -0.06,
      currentSnapshotTime: "2026-03-30T21:26:26.795Z",
    },
  );

  assert.doesNotMatch(text, /✨ Прибыль за сделку:/);
  assert.match(text, /🧮 Realized Δ: 🔴 -0.06\$/);
});

test("does not fall back to lifetime runtime metric for day profit in telegram message", () => {
  const text = buildTradeActivityMessage(
    {
      symbol: "SOLUSDT",
      bybit_bot_id: "bot-1",
      leverage: 3,
    },
    {
      equity: 241.48,
      grid_profit: 1.44,
      operation_time_ms: 167299000,
      total_pnl: -2.2,
    },
    {
      activityCountDelta: 2,
      gridProfitDelta: 0.29,
      fundingFeesDelta: -0.06,
      realizedPnlDelta: 0.3,
      currentSnapshotTime: "2026-03-28T11:05:00.000Z",
    },
  );

  assert.doesNotMatch(text, /📆 Прибыль за день:/);
});

test("detects bot closure on transition to completed", () => {
  const event = detectBotClosure(
    {
      snapshot_time: "2026-03-28T11:00:00.000Z",
      status: "FUTURE_GRID_STATUS_RUNNING",
      total_pnl: 1.8,
      realized_pnl: 1.1,
    },
    {
      snapshot_time: "2026-03-28T11:05:00.000Z",
      status: "FUTURE_GRID_STATUS_COMPLETED",
      total_pnl: 4.02,
      realized_pnl: 4.02,
    },
    {
      take_profit_price: 89.01,
      stop_loss_price: null,
      last_price: 89.0,
    },
  );

  assert.deepEqual(event, {
    currentSnapshotTime: "2026-03-28T11:05:00.000Z",
    closeProfit: 4.02,
    realizedPnl: 4.02,
    closeReason: "take profit",
  });
});

test("builds compact telegram message for bot closure", () => {
  const text = buildBotClosureMessage(
    {
      symbol: "SOLUSDT",
      bybit_bot_id: "bot-1",
      leverage: 3,
    },
    {
      equity: 245.02,
      total_pnl: 4.02,
    },
    {
      closeProfit: 4.02,
      realizedPnl: 4.02,
      closeReason: "take profit",
      currentSnapshotTime: "2026-03-28T11:05:00.000Z",
    },
  );

  assert.match(text, /🔒 Бот закрыт \+4.02\$/);
  assert.match(text, /🤖 SOLUSDT x3/);
  assert.match(text, /🏷️ Причина: take profit/);
  assert.match(text, /🧾 Итоговый total: \+4.02/);
  assert.match(text, /💼 Баланс на закрытии: \$245.02/);
  assert.match(text, /💵 Realized: \+4.02/);
});

test("computes current day profit from local midnight anchors like the table", () => {
  const originalNow = Date.now;
  Date.now = () => Date.parse("2026-03-29T12:00:00.000+04:00");

  try {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "telegram-profit-test-")), "test.sqlite");
    ensureWarehouseSchema(dbPath);
    const botPk = upsertBotRecord(
      dbPath,
      {
        bybit_bot_id: "test-bot-midnight-profit",
        symbol: "SOLUSDT",
        status: "FUTURE_GRID_STATUS_RUNNING",
      },
      "2026-03-28T20:00:00.000Z",
    );
    insertBotSnapshot(dbPath, {
      bot_pk: botPk,
      source: "test",
      snapshot_time: "2026-03-28T19:59:00.000Z",
      symbol: "SOLUSDT",
      status: "FUTURE_GRID_STATUS_RUNNING",
      grid_profit: 1.0,
    });
    insertBotSnapshot(dbPath, {
      bot_pk: botPk,
      source: "test",
      snapshot_time: "2026-03-29T07:30:00.000Z",
      symbol: "SOLUSDT",
      status: "FUTURE_GRID_STATUS_RUNNING",
      grid_profit: 1.44,
    });

    const todayProfit = computeCurrentDayProfit(
      dbPath,
      {
        bot_pk: botPk,
        bybit_bot_id: "test-bot-midnight-profit",
        confirmed_at: "2026-03-28T20:00:00.000Z",
      },
      {
        grid_profit: 1.44,
      },
    );

    assert.equal(todayProfit, 0.44);
  } finally {
    Date.now = originalNow;
  }
});
