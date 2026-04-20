import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { getDatabasePath } from "../shared/database-path";
import { apiStore, warehouse } from "../shared/legacy-bridge";

@Injectable()
export class StatsExclusionsService {
  async updateBotExclusion(botId: string, payload: unknown) {
    const body = normalizePayload(payload);
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    const current = warehouse.getStatsExclusionByBotPk(dbPath, bot.bot_pk);
    const record = warehouse.upsertBotStatsExclusion(
      dbPath,
      bot.bot_pk,
      {
        exclude_from_plan: body.excludeFromPlan ?? toBoolean(current?.exclude_from_plan),
        exclude_from_period_stats: body.excludeFromPeriodStats ?? toBoolean(current?.exclude_from_period_stats),
        exclude_reason:
          body.excludeReason !== undefined ? body.excludeReason : typeof current?.exclude_reason === "string" ? current.exclude_reason : null,
        exclude_note:
          body.excludeNote !== undefined ? body.excludeNote : typeof current?.exclude_note === "string" ? current.exclude_note : null,
      },
      new Date().toISOString()
    );

    return normalizeRecord(record);
  }

  async updateClosedRunExclusion(closedRunPk: number, payload: unknown) {
    const body = normalizePayload(payload);
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const run = apiStore.getClosedBotRunByPk(dbPath, closedRunPk);
    if (!run) {
      throw new NotFoundException(`Closed run not found: ${closedRunPk}`);
    }

    const current = warehouse.getStatsExclusionByClosedRunPk(dbPath, closedRunPk);
    const record = warehouse.upsertClosedRunStatsExclusion(
      dbPath,
      closedRunPk,
      {
        exclude_from_period_stats:
          body.excludeFromPeriodStats ?? toBoolean(current?.exclude_from_period_stats),
        exclude_from_closed_stats:
          body.excludeFromClosedStats ?? toBoolean(current?.exclude_from_closed_stats),
        exclude_reason:
          body.excludeReason !== undefined ? body.excludeReason : typeof current?.exclude_reason === "string" ? current.exclude_reason : null,
        exclude_note:
          body.excludeNote !== undefined ? body.excludeNote : typeof current?.exclude_note === "string" ? current.exclude_note : null,
      },
      new Date().toISOString()
    );

    return normalizeRecord(record);
  }
}

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new BadRequestException("Exclusion payload must be an object.");
  }

  const body = payload as Record<string, unknown>;
  return {
    excludeFromPlan:
      Object.prototype.hasOwnProperty.call(body, "excludeFromPlan") ? Boolean(body.excludeFromPlan) : undefined,
    excludeFromPeriodStats:
      Object.prototype.hasOwnProperty.call(body, "excludeFromPeriodStats") ? Boolean(body.excludeFromPeriodStats) : undefined,
    excludeFromClosedStats:
      Object.prototype.hasOwnProperty.call(body, "excludeFromClosedStats") ? Boolean(body.excludeFromClosedStats) : undefined,
    excludeReason:
      Object.prototype.hasOwnProperty.call(body, "excludeReason") ? normalizeReason(body.excludeReason) : undefined,
    excludeNote:
      Object.prototype.hasOwnProperty.call(body, "excludeNote")
        ? typeof body.excludeNote === "string"
          ? body.excludeNote.trim().slice(0, 1000)
          : null
        : undefined,
  };
}

function normalizeReason(value: unknown) {
  const allowed = new Set([
    "experiment",
    "technical",
    "duplicate",
    "invalid_data",
    "manual_ignore",
    "migration",
    "other",
  ]);

  return allowed.has(String(value)) ? String(value) : null;
}

function normalizeRecord(record: Record<string, unknown> | null) {
  if (!record) {
    return null;
  }

  return {
    exclusionPk: Number(record.exclusion_pk),
    botPk: record.bot_pk === null ? null : Number(record.bot_pk),
    closedRunPk: record.closed_run_pk === null ? null : Number(record.closed_run_pk),
    excludeFromPlan: Boolean(record.exclude_from_plan),
    excludeFromPeriodStats: Boolean(record.exclude_from_period_stats),
    excludeFromClosedStats: Boolean(record.exclude_from_closed_stats),
    excludeReason: typeof record.exclude_reason === "string" && record.exclude_reason.trim() ? record.exclude_reason : null,
    excludeNote: typeof record.exclude_note === "string" && record.exclude_note.trim() ? record.exclude_note : null,
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : null,
  };
}

function toBoolean(value: unknown) {
  if (value === true || value === 1 || value === "1") {
    return true;
  }
  return false;
}
