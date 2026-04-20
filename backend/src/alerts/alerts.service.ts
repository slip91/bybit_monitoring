import { Injectable, NotFoundException } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, dto, warehouse } from "../shared/legacy-bridge";

@Injectable()
export class AlertsService {
  async listAlerts(limit: number) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    return apiStore.listRecentAlerts(dbPath, limit).map(dto.toAlertDto);
  }

  async acknowledgeAlert(alertId: number) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const alert = apiStore.getAlertById(dbPath, alertId);
    if (!alert) {
      throw new NotFoundException(`Alert not found: ${alertId}`);
    }

    apiStore.acknowledgeAlert(dbPath, alertId, new Date().toISOString());
    return dto.toAlertDto(apiStore.getAlertById(dbPath, alertId));
  }

  async suppressAlert(alertId: number) {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const alert = apiStore.getAlertById(dbPath, alertId);
    if (!alert) {
      throw new NotFoundException(`Alert not found: ${alertId}`);
    }

    apiStore.suppressAlert(dbPath, alertId, new Date().toISOString());
    return dto.toAlertDto(apiStore.getAlertById(dbPath, alertId));
  }
}

