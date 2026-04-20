import { Controller, Get, Inject } from "@nestjs/common";

import { ClosedBotsService } from "./closed-bots.service";

@Controller("history")
export class ClosedBotsController {
  constructor(@Inject(ClosedBotsService) private readonly closedBotsService: ClosedBotsService) {}

  @Get("closed-bots")
  async getClosedBotsHistory() {
    return { data: await this.closedBotsService.getClosedBotsHistory() };
  }
}
