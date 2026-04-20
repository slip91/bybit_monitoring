import { BadRequestException, Controller, Get, Inject, Query } from "@nestjs/common";

import { PeriodSummaryService } from "./period-summary.service";
import type { PeriodWindowKey, SummaryComposition } from "./period-summary-metrics";

const WINDOW_KEYS: PeriodWindowKey[] = ["1d", "7d", "30d", "90d", "500d", "all"];
const COMPOSITIONS: SummaryComposition[] = ["active", "combined", "closed"];

@Controller("summary")
export class PeriodSummaryController {
  constructor(@Inject(PeriodSummaryService) private readonly periodSummaryService: PeriodSummaryService) {}

  @Get("period")
  async getPeriodSummary(
    @Query("window") rawWindowKey: string | undefined,
    @Query("composition") rawComposition: string | undefined
  ) {
    const windowKey = WINDOW_KEYS.includes(rawWindowKey as PeriodWindowKey)
      ? (rawWindowKey as PeriodWindowKey)
      : "7d";
    const composition = COMPOSITIONS.includes(rawComposition as SummaryComposition)
      ? (rawComposition as SummaryComposition)
      : "combined";

    if (!WINDOW_KEYS.includes(windowKey) || !COMPOSITIONS.includes(composition)) {
      throw new BadRequestException("Unsupported period summary query.");
    }

    return { data: await this.periodSummaryService.getPeriodSummary(windowKey, composition) };
  }
}
