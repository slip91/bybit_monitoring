import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PeriodSummaryPage } from "@pages/PeriodSummaryPage";

vi.mock("../lib/api", () => ({
  getPeriodSummary: vi.fn(),
  updateBotStatsExclusion: vi.fn(),
  updateClosedRunStatsExclusion: vi.fn(),
}));

const { getPeriodSummary, updateBotStatsExclusion, updateClosedRunStatsExclusion } = await import("../lib/api");

describe("PeriodSummaryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateBotStatsExclusion).mockResolvedValue({ data: {} });
    vi.mocked(updateClosedRunStatsExclusion).mockResolvedValue({ data: {} });
    vi.mocked(getPeriodSummary).mockResolvedValue({
      data: {
        window: {
          key: "7d",
          label: "7 дней",
          requestedDays: 7,
          periodStart: "2026-03-20T21:00:00.000Z",
          periodEnd: "2026-03-27T21:00:00.000Z",
          observedDays: 0.25,
          coverageRatio: 0.0357,
          coverageStatus: "incomplete" as const,
        },
        composition: {
          key: "combined" as const,
          label: "Активные + закрытые",
        },
        summary: {
          netPnl: 1.5,
          realizedPnl: 2,
          combinedPnl: 1.5,
          averagePnlPerDay: 6,
          averagePnlPerDayStatus: "unavailable" as const,
          confidenceLevel: "low" as const,
          botsInvolvedCount: 2,
          activeBotsCount: 1,
          closedBotsCount: 1,
          excludedBotsCount: 0,
          excludedRunsCount: 0,
          profitableBotsCount: 1,
          losingBotsCount: 1,
          bestBot: {
            botId: "active-1",
            symbol: "SOLUSDT",
            leverage: null,
            sourceKind: "active" as const,
            combinedPnl: 3,
            realizedPnl: 2,
            profitabilityStatus: "profit" as const,
          },
          worstBot: {
            botId: "closed-1",
            symbol: "BTCUSDT",
            leverage: null,
            sourceKind: "closed" as const,
            combinedPnl: -1.5,
            realizedPnl: null,
            profitabilityStatus: "loss" as const,
          },
          realizedPnlCoverageRatio: 0.5,
          realizedPnlStatus: "incomplete" as const,
          lifetimeCoverageRatio: 0,
          lifetimeStatus: "unavailable" as const,
          usesFinalPnlProxy: true,
          notes: ["partial_period", "uses_final_pnl_proxy"],
        },
        items: [
          {
            key: "active:1",
            sourceKind: "active" as const,
            botId: "active-1",
            symbol: "SOLUSDT",
            botType: "futures_grid",
            leverage: null,
            currentStatus: "active" as const,
            periodPnl: 3,
            realizedPnl: 2,
            combinedPnl: 3,
            averagePnlPerDay: null,
            observedDays: 0.25,
            closedAt: null,
            lifetimeDays: null,
            realizedPnlStatus: "available" as const,
            lifetimeStatus: "unavailable" as const,
            dataQualityStatus: "available" as const,
            excludeFromPeriodStats: false,
            excludeFromClosedStats: false,
            excludeReason: null,
            profitabilityStatus: "profit" as const,
          },
        ],
      },
    });
  });

  it("renders period summary selectors and metrics", async () => {
    render(<MemoryRouter><PeriodSummaryPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Общая статистика за период" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 день/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Только активные боты/i })).toBeInTheDocument();
    expect(screen.getByText("Кто вошел в сводку периода")).toBeInTheDocument();
    expect(screen.getByText(/Proxy usage/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Средний PnL\/день пока скрыт/i).length).toBeGreaterThan(0);
  });
});
