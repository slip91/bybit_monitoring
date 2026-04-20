import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";

import { PlanService } from "./plan.service";

@Controller("plans")
export class PlanController {
  constructor(@Inject(PlanService) private readonly planService: PlanService) {}

  @Get("current")
  async getCurrentPlan() {
    return { data: await this.planService.getCurrentPlan() };
  }

  @Put("current")
  async updateCurrentPlan(@Body() body: unknown) {
    return { data: await this.planService.updateCurrentPlan(body) };
  }

  @Put("current/bots/:botId")
  async updateCurrentPlanBot(@Param("botId") botId: string, @Body() body: unknown) {
    return { data: await this.planService.updateCurrentPlanBot(botId, body) };
  }
}
