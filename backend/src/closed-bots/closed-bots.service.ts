import { Injectable } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, warehouse } from "../shared/legacy-bridge";
import { buildClosedBotsDto } from "./closed-bots-metrics";

@Injectable()
export class ClosedBotsService {
  async getClosedBotsHistory() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    warehouse.syncClosedBotRunsFromCompletedHistory(dbPath);
    const summary = apiStore.getClosedBotRunsSummary(dbPath);
    const items = apiStore.listClosedBotRuns(dbPath, 100);
    return buildClosedBotsDto(summary, items);
  }
}
