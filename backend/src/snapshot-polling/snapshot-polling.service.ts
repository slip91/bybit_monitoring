import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { runtime, snapshotRunner, warehouse } from "../shared/legacy-bridge";
import { pollTelegramCommands } from "./telegram-command-polling";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_COMMAND_INTERVAL_MS = 15 * 1000;
const SERVICE_NAME = "snapshot_active_bots";

@Injectable()
export class SnapshotPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SnapshotPollingService.name);
  private readonly intervalMs = parseIntervalMs(process.env.SNAPSHOT_POLLING_INTERVAL_MS);
  private readonly commandIntervalMs = parseIntervalMs(process.env.TELEGRAM_COMMAND_POLL_INTERVAL_MS, DEFAULT_COMMAND_INTERVAL_MS);
  private readonly enabled = process.env.SNAPSHOT_POLLING_ENABLED !== "false";
  private readonly config = buildPollingConfig();

  private timer: NodeJS.Timeout | null = null;
  private commandTimer: NodeJS.Timeout | null = null;
  private activeRun: Promise<unknown> | null = null;
  private activeCommandRun: Promise<unknown> | null = null;
  private shuttingDown = false;

  onModuleInit() {
    warehouse.ensureWarehouseSchema(this.config.dbPath);

    if (!this.enabled) {
      this.logger.log("snapshot polling disabled via SNAPSHOT_POLLING_ENABLED=false");
      warehouse.updateServiceStatus(this.config.dbPath, SERVICE_NAME, {
        status: "idle",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    this.logger.log(`snapshot polling enabled interval_ms=${this.intervalMs} db=${this.config.dbPath}`);
    warehouse.updateServiceStatus(this.config.dbPath, SERVICE_NAME, {
      status: "idle",
      updated_at: new Date().toISOString(),
    });

    void this.runCycle("startup");
    void this.runTelegramCommandCycle("startup");
  }

  async onModuleDestroy() {
    this.shuttingDown = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    if (this.activeRun) {
      this.logger.log("waiting for active snapshot cycle to finish");
      try {
        await this.activeRun;
      } catch (error) {
        this.logger.error(`active cycle finished with error=${toMessage(error)}`);
      }
    }
    if (this.activeCommandRun) {
      this.logger.log("waiting for active telegram command cycle to finish");
      try {
        await this.activeCommandRun;
      } catch (error) {
        this.logger.error(`telegram command cycle finished with error=${toMessage(error)}`);
      }
    }

    warehouse.updateServiceStatus(this.config.dbPath, SERVICE_NAME, {
      status: "stopped",
      updated_at: new Date().toISOString(),
    });
    this.logger.log("snapshot polling stopped");
  }

  private scheduleNextCommandPoll() {
    if (this.shuttingDown || !this.enabled) {
      return;
    }

    this.commandTimer = setTimeout(() => {
      this.commandTimer = null;
      void this.runTelegramCommandCycle("timer");
    }, this.commandIntervalMs);
  }

  private scheduleNext() {
    if (this.shuttingDown || !this.enabled) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle("timer");
    }, this.intervalMs);
  }

  private async runCycle(trigger: "startup" | "timer") {
    if (this.shuttingDown || !this.enabled) {
      return;
    }

    if (this.activeRun) {
      this.logger.warn(`previous snapshot cycle still running; skipping trigger=${trigger}`);
      return;
    }

    const run = snapshotRunner.runActiveBotSnapshotCycle({
      config: this.config,
      serviceName: SERVICE_NAME,
      logger: {
        info: (message: string) => this.logger.log(message),
        error: (message: string) => this.logger.error(message),
      },
    });

    this.activeRun = run;

    try {
      await run;
    } catch (error) {
      this.logger.error(`snapshot cycle aborted trigger=${trigger} error=${toMessage(error)}`);
    } finally {
      this.activeRun = null;
      this.scheduleNext();
    }
  }

  private async runTelegramCommandCycle(trigger: "startup" | "timer") {
    if (this.shuttingDown || !this.enabled) {
      return;
    }

    if (this.activeCommandRun) {
      this.logger.warn(`previous telegram command cycle still running; skipping trigger=${trigger}`);
      return;
    }

    const run = pollTelegramCommands(this.config.dbPath, {
      log: (message: string) => this.logger.log(message),
      warn: (message: string) => this.logger.warn(message),
    });

    this.activeCommandRun = run;

    try {
      await run;
    } catch (error) {
      this.logger.error(`telegram command cycle aborted trigger=${trigger} error=${toMessage(error)}`);
    } finally {
      this.activeCommandRun = null;
      this.scheduleNextCommandPoll();
    }
  }
}

function buildPollingConfig() {
  const legacyConfig = runtime.getRuntimeConfig();
  return {
    ...legacyConfig,
    dbPath: getDatabasePath(),
  };
}

function parseIntervalMs(rawValue: string | undefined, fallback = DEFAULT_INTERVAL_MS) {
  const parsed = Number(rawValue || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
