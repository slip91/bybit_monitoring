import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";

import { BotsService } from "./bots.service";
import { ListBotsQueryDto } from "./dto/list-bots-query.dto";
import { GetBotMarketChartQueryDto } from "./dto/get-bot-market-chart-query.dto";

@ApiTags('bots')
@Controller("bots")
export class BotsController {
  constructor(@Inject(BotsService) private readonly botsService: BotsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bots', description: 'Get a list of all trading bots with their current status' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved bots list' })
  async listBots(@Query() query: ListBotsQueryDto) {
    return { data: await this.botsService.listBots() };
  }

  @Get(":botId/market-chart")
  @ApiOperation({ summary: 'Get bot market chart', description: 'Get market price chart data for a specific bot' })
  @ApiParam({ name: 'botId', description: 'Bot identifier' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved market chart' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  async getBotMarketChart(
    @Param("botId") botId: string,
    @Query() query: GetBotMarketChartQueryDto,
  ) {
    return { 
      data: await this.botsService.getBotMarketChart(
        botId, 
        query.interval, 
        query.range, 
        query.priceSource
      ) 
    };
  }

  @Get(":botId")
  @ApiOperation({ summary: 'Get bot details', description: 'Get detailed information about a specific bot' })
  @ApiParam({ name: 'botId', description: 'Bot identifier' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved bot details' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  async getBot(@Param("botId") botId: string) {
    return { data: await this.botsService.getBot(botId) };
  }

  @Get(":botId/snapshots")
  @ApiOperation({ summary: 'Get bot snapshots', description: 'Get historical snapshots of bot performance' })
  @ApiParam({ name: 'botId', description: 'Bot identifier' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved bot snapshots' })
  @ApiResponse({ status: 404, description: 'Bot not found' })
  async getBotSnapshots(@Param("botId") botId: string, @Query("limit") limit?: string) {
    return {
      data: await this.botsService.getBotSnapshots(botId, limit ? Number(limit) : 100000),
    };
  }
}
