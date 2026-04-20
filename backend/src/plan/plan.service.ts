import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { buildCurrentPlanDto } from "./plan-metrics";
import { getDatabasePath } from "../shared/database-path";
import { apiStore, warehouse } from "../shared/legacy-bridge";

@Injectable()
export class PlanService {
  constructor() {}

  async getCurrentPlan(): Promise<unknown> {
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const plan = apiStore.getCurrentPlan(dbPath);
    if (!plan) {
      // План ещё не создан — создаём дефолтный
      warehouse.upsertCurrentPlan(dbPath, { title: "План дохода", target_daily_pnl_usd: 30, status: "active", notes: null }, new Date().toISOString());
      return this.getCurrentPlan();
    }

    warehouse.ensureCurrentPlanMemberships(dbPath, plan.plan_pk);
    const participants = apiStore.listCurrentPlanBots(dbPath, plan.plan_pk);
    const snapshots = apiStore.listCurrentPlanSnapshots(dbPath, plan.plan_pk);
    return buildCurrentPlanDto(plan, participants, snapshots);
  }

  async updateCurrentPlan(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Plan payload must be an object.");
    }

    const body = payload as Record<string, unknown>;
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const updatedAt = new Date().toISOString();
    warehouse.upsertCurrentPlan(
      dbPath,
      {
        title: normalizePlanTitle(body.title),
        target_daily_pnl_usd: parseNullableNumber(body.targetDailyPnlUsd),
        status: normalizePlanStatus(body.status),
        notes: normalizeOptionalText(body.notes),
      },
      updatedAt
    );

    return this.getCurrentPlan();
  }

  async updateCurrentPlanBot(botId: string, payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Plan bot payload must be an object.");
    }

    const body = payload as Record<string, unknown>;
    const dbPath = getDatabasePath();
    warehouse.ensureWarehouseSchema(dbPath);
    const plan = apiStore.getCurrentPlan(dbPath);
    const bot = apiStore.getBotById(dbPath, botId);
    if (!bot) {
      throw new NotFoundException(`Bot not found: ${botId}`);
    }

    warehouse.upsertPlanBotMembership(
      dbPath,
      plan.plan_pk,
      bot.bot_pk,
      {
        is_included: Boolean(body.isIncluded),
        weight: parseNullableNumber(body.weight),
      },
      new Date().toISOString()
    );

    return this.getCurrentPlan();
  }
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePlanStatus(value: unknown) {
  return ["active", "paused", "archived"].includes(String(value)) ? String(value) : null;
}

function normalizePlanTitle(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().slice(0, 1000);
}
