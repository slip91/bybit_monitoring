import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";

import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get("telegram-alerts")
  async getTelegramSettings() {
    return { data: await this.settingsService.getTelegramSettings() };
  }

  @Put("telegram-alerts")
  async updateTelegramSettings(@Body() body: unknown) {
    return { data: await this.settingsService.updateTelegramSettings(body) };
  }

  @Get("alert-rules")
  async getAlertRules() {
    const data = await this.settingsService.getAlertRules();
    return {
      data,
      meta: {
        count: data.length,
      },
    };
  }

  @Put("alert-rules/:botId/total-pnl")
  async updateTotalPnlRule(@Param("botId") botId: string, @Body() body: unknown) {
    return { data: await this.settingsService.updateTotalPnlRule(botId, body) };
  }

  @Put("alert-rules/:botId/grid-profit-capture")
  async updateGridProfitCaptureRule(@Param("botId") botId: string, @Body() body: unknown) {
    return { data: await this.settingsService.updateGridProfitCaptureRule(botId, body) };
  }

  @Put("telegram-alerts/test-trade/:botId")
  async sendTestTradeNotification(@Param("botId") botId: string) {
    return { data: await this.settingsService.sendTestTradeNotification(botId) };
  }

  @Put("telegram-alerts/test-grid-profit-capture/:botId")
  async sendTestGridProfitCaptureNotification(@Param("botId") botId: string) {
    return { data: await this.settingsService.sendTestGridProfitCaptureNotification(botId) };
  }
}
