import { Module } from "@nestjs/common";

import { StatsExclusionsController } from "./stats-exclusions.controller";
import { StatsExclusionsService } from "./stats-exclusions.service";

@Module({
  controllers: [StatsExclusionsController],
  providers: [StatsExclusionsService],
})
export class StatsExclusionsModule {}
