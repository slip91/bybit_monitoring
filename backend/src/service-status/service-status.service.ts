import { Injectable } from "@nestjs/common";

import { dto, warehouse } from "../shared/legacy-bridge";
import { apiStore } from "../shared/legacy-bridge";
import { getDatabasePath } from "../shared/database-path";

@Injectable()
export class ServiceStatusService {
  getSnapshotStatus() {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    return dto.toServiceStatusDto(apiStore.getServiceStatus(dbPath, "snapshot_active_bots"), "snapshot_active_bots");
  }
}
