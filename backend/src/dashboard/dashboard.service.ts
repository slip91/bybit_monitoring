import { Injectable } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, dto, warehouse } from "../shared/legacy-bridge";

@Injectable()
export class DashboardService {
  async getSummary() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const summary = apiStore.getDashboardSummary(dbPath) || {};
    const statusBreakdown = apiStore.getDashboardStatusBreakdown(dbPath);
    const botTypeBreakdown = apiStore.getDashboardBotTypeBreakdown(dbPath);
    return dto.toDashboardSummaryDto(summary, statusBreakdown, botTypeBreakdown);
  }
}

