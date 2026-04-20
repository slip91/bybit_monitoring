export type AggregationMode = "recent" | "30d" | "full";

export type AggregationOptions = {
  mode: AggregationMode;
  /** Сколько точек показывать в режиме recent */
  recentCount: number;
  /** Максимум точек в режиме full (после биннинга) */
  maxBins: number;
}

export function defaultOptions(): AggregationOptions {
  return { mode: "recent", recentCount: 100, maxBins: 150 };
}

export type AggregatedSlice<T> = {
  labels: Array<string>;
  items: T[];
}

/**
 * Агрегирует массив данных в зависимости от режима:
 * - "recent" — берёт последние N элементов без изменений
 * - "30d" — берёт снапшоты за последние 30 дней с биннингом до ~150 точек
 * - "full" — весь период с биннингом до ~150 точек
 */
export function aggregateByTime<T>(
  items: T[],
  getTimestamp: (item: T) => number,
  options: AggregationOptions,
): AggregatedSlice<T> {
  if (items.length === 0) {
    return { labels: [], items: [] };
  }

  const sorted = [...items].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  const latestTs = getTimestamp(sorted[sorted.length - 1]!);

  let windowed = sorted;
  if (options.mode === "recent") {
    windowed = sorted.slice(-options.recentCount);
  } else if (options.mode === "30d") {
    const threshold = latestTs - 30 * 86400000;
    windowed = sorted.filter((item) => getTimestamp(item) >= threshold);
  }

  if (windowed.length <= options.maxBins) {
    return {
      labels: windowed.map((item) => String(getTimestamp(item))),
      items: windowed,
    };
  }

  const binSize = windowed.length / options.maxBins;
  const result: T[] = [];

  for (let i = 0; i < options.maxBins; i++) {
    const binEnd = Math.min(Math.floor((i + 1) * binSize), windowed.length);
    result.push(windowed[binEnd - 1]!);
  }

  return {
    labels: result.map((item) => String(getTimestamp(item))),
    items: result,
  };
}

/** Форматирует unix-ms в короткую метку времени */
export function formatBinLabel(tsMs: number, _mode: AggregationMode = "full"): string {
  const date = new Date(tsMs);
  if (Number.isNaN(date.getTime())) return String(tsMs);
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Описание периода для aside */
export function aggregationPeriodLabel(mode: AggregationMode, itemCount: number, totalCount: number): string {
  if (mode === "recent") {
    return `последние ${itemCount} из ${totalCount}`;
  }
  if (mode === "30d") {
    return `30 дней · ${itemCount} точек`;
  }
  return `всё время · ${itemCount} точек`;
}
