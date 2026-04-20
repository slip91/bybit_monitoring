export type MarketChartRange = "24h" | "7d" | "30d" | "90d" | "1y" | "lifetime";
export type MarketChartPriceSource = "market" | "mark" | "index";
export type MarketChartInterval = "15" | "60" | "240" | "D" | "W";

export function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeStartedAt(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }

    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) {
      return dateMs;
    }
  }

  return null;
}

export function chooseKlineInterval(startMs: number | null, endMs: number): MarketChartInterval {
  const runtimeDays = startMs === null ? null : Math.max(0, endMs - startMs) / 86400000;
  if (runtimeDays !== null && runtimeDays <= 3) {
    return "15";
  }
  if (runtimeDays !== null && runtimeDays <= 14) {
    return "60";
  }
  if (runtimeDays !== null && runtimeDays <= 90) {
    return "240";
  }
  return "D";
}

export function normalizeInterval(value: string | undefined, startMs: number | null, endMs: number): MarketChartInterval {
  const allowed = new Set<MarketChartInterval>(["15", "60", "240", "D", "W"]);
  if (value && allowed.has(value as MarketChartInterval)) {
    return value as MarketChartInterval;
  }

  return chooseKlineInterval(startMs, endMs);
}

export function normalizeRange(value: string | undefined): MarketChartRange {
  if (value === "24h" || value === "7d" || value === "30d" || value === "90d" || value === "1y" || value === "lifetime") {
    return value;
  }

  return "lifetime";
}

export function normalizePriceSource(value: string | undefined): MarketChartPriceSource {
  if (value === "market" || value === "mark" || value === "index") {
    return value;
  }

  return "market";
}

export function selectRangeStartMs(range: MarketChartRange, lifetimeStartedAt: number | null, endMs: number) {
  if (range === "24h") {
    return endMs - 86400000;
  }
  if (range === "7d") {
    return endMs - 7 * 86400000;
  }
  if (range === "30d") {
    return endMs - 30 * 86400000;
  }
  if (range === "90d") {
    return endMs - 90 * 86400000;
  }
  if (range === "1y") {
    return endMs - 365 * 86400000;
  }

  return lifetimeStartedAt;
}
