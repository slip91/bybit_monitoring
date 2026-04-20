import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AlertsModule } from "./alerts/alerts.module";
import { BotsModule } from "./bots/bots.module";
import { ClosedBotsModule } from "./closed-bots/closed-bots.module";
import { LoggerModule } from "./common/logger/logger.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { PlanModule } from "./plan/plan.module";
import { PeriodSummaryModule } from "./period-summary/period-summary.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SettingsModule } from "./settings/settings.module";
import { ServiceStatusModule } from "./service-status/service-status.module";
import { SnapshotPollingModule } from "./snapshot-polling/snapshot-polling.module";
import { StatsExclusionsModule } from "./stats-exclusions/stats-exclusions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    LoggerModule,
    PrismaModule,
    SnapshotPollingModule,
    HealthModule,
    ServiceStatusModule,
    DashboardModule,
    ClosedBotsModule,
    PeriodSummaryModule,
    AlertsModule,
    SettingsModule,
    StatsExclusionsModule,
    BotsModule,
    PlanModule,
  ],
})
export class AppModule {}
