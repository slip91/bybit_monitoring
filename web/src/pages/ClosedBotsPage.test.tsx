import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClosedBotsPage } from "@pages/ClosedBotsPage";

vi.mock("../lib/api", () => ({
  getClosedBotsHistory: vi.fn(),
  updateClosedRunStatsExclusion: vi.fn(),
}));

const { getClosedBotsHistory, updateClosedRunStatsExclusion } = await import("../lib/api");

describe("ClosedBotsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateClosedRunStatsExclusion).mockResolvedValue({ data: {} });
    vi.mocked(getClosedBotsHistory).mockResolvedValue({
      data: {
        summary: {
          closedBotsCount: 2,
          totalFinalPnl: 4.2,
          totalRealizedPnl: null,
          profitableClosedBots: 1,
          losingClosedBots: 1,
          avgPnlPer100Usd: 0.5,
          avgPnlPerDay: null,
          avgLifetimeDays: null,
          realizedPnlCoverageRatio: 0,
          lifetimeCoverageRatio: 0,
          closeReasonCoverageRatio: 0,
          strategyTagCoverageRatio: 0,
          realizedPnlStatus: "unavailable" as const,
          lifetimeStatus: "unavailable" as const,
          closeReasonStatus: "unavailable" as const,
          strategyTagStatus: "unavailable" as const,
          excludedRunsCount: 1,
          usesFinalPnlProxy: true,
        },
        items: [
          {
            closedRunPk: 2,
            legacyBotId: "bot-2",
            botPk: null,
            symbol: "XRPUSDT",
            botType: "futures_grid",
            leverage: null,
            strategyTag: null,
            closeReason: null,
            closeReasonDetail: null,
            startedAt: null,
            closedAt: "2026-03-26T15:55:01.000Z",
            firstObservedAt: "2026-03-26T15:55:01.000Z",
            lastObservedAt: "2026-03-26T15:55:01.000Z",
            snapshotCount: 1,
            investment: 100,
            realizedPnl: null,
            realizedPnlStatus: "unavailable" as const,
            unrealizedPnl: null,
            totalPnl: -3.2,
            finalPnl: -3.2,
            averagePnlPerDay: null,
            equityAtClose: 96.8,
            lifetimeDays: null,
            lifetimeStatus: "unavailable" as const,
            source: "completed_fgrid_history",
            profitabilityStatus: "loss" as const,
            closeReasonStatus: "unavailable" as const,
            strategyTagStatus: "unavailable" as const,
            excludeFromPeriodStats: false,
            excludeFromClosedStats: true,
            excludeReason: "manual_ignore" as const,
          },
          {
            closedRunPk: 1,
            legacyBotId: "bot-1",
            botPk: null,
            symbol: "SOLUSDT",
            botType: "futures_grid",
            leverage: null,
            strategyTag: null,
            closeReason: null,
            closeReasonDetail: null,
            startedAt: null,
            closedAt: "2026-03-27T15:55:01.000Z",
            firstObservedAt: "2026-03-27T15:55:01.000Z",
            lastObservedAt: "2026-03-27T15:55:01.000Z",
            snapshotCount: 1,
            investment: 100,
            realizedPnl: null,
            realizedPnlStatus: "unavailable" as const,
            unrealizedPnl: null,
            totalPnl: 4.2,
            finalPnl: 4.2,
            averagePnlPerDay: null,
            equityAtClose: 104.2,
            lifetimeDays: null,
            lifetimeStatus: "unavailable" as const,
            source: "completed_fgrid_history",
            profitabilityStatus: "profit" as const,
            closeReasonStatus: "unavailable" as const,
            strategyTagStatus: "unavailable" as const,
            excludeFromPeriodStats: false,
            excludeFromClosedStats: false,
            excludeReason: null,
          },
        ],
      },
    });
  });

  it("renders the summary and table in russian", async () => {
    render(<ClosedBotsPage />);

    expect(await screen.findByRole("heading", { name: "Закрытые боты" })).toBeInTheDocument();
    expect(screen.getAllByText("Реализованная прибыль").length).toBeGreaterThan(0);
    expect(screen.getByText("Итоговая прибыль как proxy")).toBeInTheDocument();
    expect(screen.getByText("Закрытые запуски ботов")).toBeInTheDocument();
    expect(screen.getAllByText("Источник не отдал").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Причина закрытия не пришла из source").length).toBeGreaterThan(0);
    expect(screen.getByText("XRPUSDT")).toBeInTheDocument();
    expect(screen.getByText("Исключен · игнор вручную")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Вернуть" })).toBeInTheDocument();
  });
});
