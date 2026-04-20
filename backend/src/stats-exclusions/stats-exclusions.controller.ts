import { BadRequestException, Controller, Inject, Param, Put, Body } from "@nestjs/common";

import { StatsExclusionsService } from "./stats-exclusions.service";

@Controller("stats/exclusions")
export class StatsExclusionsController {
  constructor(@Inject(StatsExclusionsService) private readonly statsExclusionsService: StatsExclusionsService) {}

  @Put("bots/:botId")
  async updateBotExclusion(@Param("botId") botId: string, @Body() payload: unknown) {
    return { data: await this.statsExclusionsService.updateBotExclusion(botId, payload) };
  }

  @Put("closed-runs/:closedRunPk")
  async updateClosedRunExclusion(@Param("closedRunPk") closedRunPk: string, @Body() payload: unknown) {
    const parsed = Number(closedRunPk);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException("closedRunPk must be a positive integer.");
    }

    return { data: await this.statsExclusionsService.updateClosedRunExclusion(parsed, payload) };
  }
}
