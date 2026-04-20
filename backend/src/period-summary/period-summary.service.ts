import { Injectable } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, warehouse } from "../shared/legacy-bridge";
import { buildPeriodSummaryDto, type PeriodWindowKey, type SummaryComposition } from "./period-summary-metrics";

@Injectable()
export class PeriodSummaryService {
  async getPeriodSummary(windowKey: PeriodWindowKey, composition: SummaryComposition) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    warehouse.syncClosedBotRunsFromCompletedHistory(dbPath);
    const bounds = apiStore.getPeriodSummaryBounds(dbPath);
    const activeLatestMs = normalizeTimestampMs(bounds?.active_max_snapshot_time);
    const closedLatestMs = normalizeTimestampMs(bounds?.closed_max_time);
    const latestRaw =
      composition === "active"
        ? bounds?.active_max_snapshot_time || null
        : composition === "closed"
          ? bounds?.closed_max_time || null
          : activeLatestMs === null && closedLatestMs === null
            ? null
            : new Date(Math.max(activeLatestMs ?? -Infinity, closedLatestMs ?? -Infinity)).toISOString();
    const latestMs = normalizeTimestampMs(latestRaw);
    const requestedDays = windowKey === "all" ? null : Number(windowKey.replace("d", ""));
    const startTime =
      latestMs !== null && requestedDays !== null
        ? new Date(latestMs - requestedDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const activeRows =
      composition === "closed" ? [] : apiStore.listActiveBotSnapshotsForPeriodSummary(dbPath, startTime);
    const closedRows =
      composition === "active" ? [] : apiStore.listClosedBotRunsForPeriodSummary(dbPath, startTime);

    return buildPeriodSummaryDto({
      windowKey,
      composition,
      boundsRow: bounds,
      activeRows,
      closedRows,
    });
  }
}

function normalizeTimestampMs(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
