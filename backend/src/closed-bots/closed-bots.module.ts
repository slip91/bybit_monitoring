import { Module } from "@nestjs/common";

import { ClosedBotsController } from "./closed-bots.controller";
import { ClosedBotsService } from "./closed-bots.service";

@Module({
  controllers: [ClosedBotsController],
  providers: [ClosedBotsService],
})
export class ClosedBotsModule {}
