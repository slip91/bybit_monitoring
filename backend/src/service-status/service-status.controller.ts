import { Controller, Get, Inject } from "@nestjs/common";

import { ServiceStatusService } from "./service-status.service";

@Controller("service")
export class ServiceStatusController {
  constructor(
    @Inject(ServiceStatusService)
    private readonly serviceStatusService: ServiceStatusService
  ) {}

  @Get("status")
  async getStatus() {
    return { data: await this.serviceStatusService.getSnapshotStatus() };
  }
}
