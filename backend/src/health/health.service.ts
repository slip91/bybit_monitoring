import { Injectable } from "@nestjs/common";

import { apiStore, dto, warehouse } from "../shared/legacy-bridge";
import { getDatabasePath } from "../shared/database-path";

@Injectable()
export class HealthService {
  private readonly startedAt = new Date();

  getHealth() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const summary = apiStore.getHealthSummary(dbPath) || {};
    return dto.toHealthDto(summary, dbPath, this.startedAt);
  }
}
