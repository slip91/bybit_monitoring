import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BotPage } from "@pages/BotPage";

vi.mock("../lib/api", () => ({
  getBot: vi.fn(),
  getBotMarketChart: vi.fn(),
  getBotSnapshots: vi.fn(),
}));

const { getBot, getBotMarketChart, getBotSnapshots } = await import("../lib/api");

describe("BotPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBot).mockResolvedValue({
      data: {
        id: "612367354935931891",
        botPk: 3,
        bybitBotId: "612367354935931891",
        guessedKey: null,
        identityStatus: "matched",
        inferenceConfidence: 1,
        inferenceReason: null,
        symbol: "SOLUSDT",
        botType: "futures_grid",
        leverage: 2,
        status: "FUTURE_GRID_STATUS_RUNNING",
        route: null,
        source: "warehouse",
        isActive: true,
        firstSeenAt: "2026-03-27T17:34:00.870Z",
        lastSeenAt: "2026-03-28T07:32:31.030Z",
        confirmedAt: "2026-03-27T17:34:00.870Z",
        lastSnapshotAt: "2026-03-28T07:32:31.030Z",
        snapshotCount: 10,
        openAlertCount: 0,
        runtimeStartedAt: "2026-03-27T17:34:00.870Z",
        runtimeSec: 36000,
        runtimeDays: 0.4167,
        workStartedAt: "2026-03-27T17:00:00.000Z",
        workRuntimeSec: 39600,
        gridProfitPerDay: 1.15,
        factPnlPerDay: -4.8,
        annualizedRuntimeDays: null,
        annualizedCapitalBase: null,
        derivedAnnualizedTotalYieldRatio: null,
        derivedAnnualizedStatus: "unavailable" as const,
        latestSnapshot: {
          snapshotId: 1,
          snapshotTime: "2026-03-28T07:32:31.030Z",
          source: "warehouse",
          symbol: "SOLUSDT",
          botType: "futures_grid",
          status: "FUTURE_GRID_STATUS_RUNNING",
          equity: 242.05,
          totalPnl: -1.94,
          totalApr: -2.9049,
          gridApr: 1.7264,
          gridProfit: 1.15,
          leverage: 2,
          activityCount: 24,
          pnlGap: null,
          pnlToEquityRatio: null,
          activityScore: null,
          drawdownFromLocalPeak: null,
          runtimeStartedAt: "2026-03-27T17:34:00.870Z",
          runtimeSec: 36000,
          runtimeDays: 0.4167,
          workStartedAt: "2026-03-27T17:00:00.000Z",
          workRuntimeSec: 39600,
          gridProfitPerDay: 1.15,
          factPnlPerDay: -4.8,
          statusHint: "grid_works_position_hurts",
          investment: 244,
          realizedPnl: null,
          unrealizedPnl: null,
          fundingFees: null,
          liquidationPrice: null,
          totalOrderBalance: null,
          availableBalance: null,
          positionBalance: null,
          annualizedRuntimeDays: null,
          annualizedCapitalBase: null,
          derivedAnnualizedTotalYieldRatio: null,
          derivedAnnualizedStatus: "unavailable" as const,
        },
      },
    });
    vi.mocked(getBotSnapshots).mockResolvedValue({
      data: [
        {
          snapshotId: 1,
          snapshotTime: "2026-03-28T07:32:31.030Z",
          source: "warehouse",
          symbol: "SOLUSDT",
          botType: "futures_grid",
          status: "FUTURE_GRID_STATUS_RUNNING",
          equity: 242.05,
          totalPnl: -1.94,
          totalApr: -2.9049,
          gridApr: 1.7264,
          gridProfit: 1.15,
          leverage: 2,
          activityCount: 24,
          pnlGap: null,
          pnlToEquityRatio: null,
          activityScore: null,
          drawdownFromLocalPeak: null,
          runtimeStartedAt: "2026-03-27T17:34:00.870Z",
          runtimeSec: 36000,
          runtimeDays: 0.4167,
          workStartedAt: "2026-03-27T17:00:00.000Z",
          workRuntimeSec: 39600,
          gridProfitPerDay: 1.15,
          factPnlPerDay: -4.8,
          statusHint: "grid_works_position_hurts",
          investment: 244,
          realizedPnl: null,
          unrealizedPnl: null,
          fundingFees: null,
          liquidationPrice: null,
          totalOrderBalance: null,
          availableBalance: null,
          positionBalance: null,
          annualizedRuntimeDays: null,
          annualizedCapitalBase: null,
          derivedAnnualizedTotalYieldRatio: null,
          derivedAnnualizedStatus: "unavailable" as const,
        },
      ],
    });
    vi.mocked(getBotMarketChart).mockResolvedValue({
      data: {
        botId: "612367354935931891",
        symbol: "SOLUSDT",
        startedAt: "2026-03-27T17:00:00.000Z",
        interval: "60",
        range: "lifetime",
        priceSource: "market",
        candles: [
          {
            time: 1711609200,
            open: 87,
            high: 88,
            low: 86.5,
            close: 87.4,
          },
          {
            time: 1711612800,
            open: 87.4,
            high: 88.2,
            low: 86.8,
            close: 87.9,
          },
        ],
        overlays: {
          currentPrice: 87.9,
          entryPrice: 87.49,
          lowerRangePrice: 60,
          upperRangePrice: 89,
          takeProfitPrice: 89.01,
          stopLossPrice: null,
          markPrice: 87.95,
        },
        grid: {
          count: 66,
        },
      },
    });
  });

  it("shows current grid profit separately from daily yield block", async () => {
    render(
      <MemoryRouter initialEntries={["/bots/612367354935931891"]}>
        <Routes>
          <Route path="/bots/:botId" element={<BotPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Прибыль сетки сейчас")).toBeInTheDocument();
    expect(screen.getByText("Доходность в день")).toBeInTheDocument();
    expect(screen.getByText("Рыночная цена и диапазон сетки")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "15m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bot lifetime" })).toBeInTheDocument();
    expect(screen.getByText("Сетка по runtime/день")).toBeInTheDocument();
    expect(screen.getByText("APR-оценка/день")).toBeInTheDocument();
    expect(screen.getByText("Факт сегодня")).toBeInTheDocument();
    expect(screen.getByLabelText("Процент от По runtime/день")).toBeInTheDocument();
    expect(screen.getByText("Доходность сетки/день")).toBeInTheDocument();
    expect(screen.getByText("Фактическая доходность сегодня")).toBeInTheDocument();
    expect(screen.getByText("APR-доходность/день")).toBeInTheDocument();
  });
});
