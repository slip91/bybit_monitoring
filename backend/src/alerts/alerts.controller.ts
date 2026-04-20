import { Controller, Get, Inject, Param, Put, Query } from "@nestjs/common";

import { AlertsService } from "./alerts.service";

@Controller("alerts")
export class AlertsController {
  constructor(@Inject(AlertsService) private readonly alertsService: AlertsService) {}

  @Get()
  async listAlerts(@Query("limit") limit?: string) {
    const normalizedLimit = limit ? Number(limit) : 50;
    return {
      data: await this.alertsService.listAlerts(normalizedLimit),
      meta: {
        limit: normalizedLimit,
      },
    };
  }

  @Put(":id/acknowledge")
  async acknowledge(@Param("id") id: string) {
    return { data: await this.alertsService.acknowledgeAlert(Number(id)) };
  }

  @Put(":id/suppress")
  async suppress(@Param("id") id: string) {
    return { data: await this.alertsService.suppressAlert(Number(id)) };
  }
}

