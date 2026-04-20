export function startOfLocalDayMs(referenceMs: number) {
  const date = new Date(referenceMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function computeGridProfitDeltaSinceWindowStart(params: {
  baselineGridProfit: number | null;
  latestGridProfit: number | null;
  firstWindowGridProfit?: number | null;
  startedAtMs?: number | null;
  windowStartMs: number;
}) {
  const { baselineGridProfit, latestGridProfit, firstWindowGridProfit = null, startedAtMs = null, windowStartMs } = params;

  if (latestGridProfit === null) {
    return null;
  }

  if (baselineGridProfit !== null) {
    return roundMetric(latestGridProfit - baselineGridProfit);
  }

  if (startedAtMs !== null && startedAtMs >= windowStartMs) {
    return roundMetric(latestGridProfit);
  }

  if (firstWindowGridProfit !== null) {
    return roundMetric(latestGridProfit - firstWindowGridProfit);
  }

  return null;
}

export function parseTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function roundMetric(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}
