import { Module } from "@nestjs/common";

import { SnapshotPollingService } from "./snapshot-polling.service";

@Module({
  providers: [SnapshotPollingService],
})
export class SnapshotPollingModule {}
