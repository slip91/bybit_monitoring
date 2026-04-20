import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getBot, getBotMarketChart, getBotSnapshots } from "@lib/api";
import { aggregateByTime, defaultOptions, formatBinLabel } from "@lib/aggregate";
import type { AggregationMode } from "@lib/aggregate";
import { factVsRuntimeRatio, toErrorMessage } from "@lib/format";
import type { BotDetails, BotMarketChart, BotSnapshot } from "@lib/types";

export function useBotPage() {
  const { botId = "" } = useParams();
  const [bot, setBot] = useState<BotDetails | null>(null);
  const [snapshots, setSnapshots] = useState<BotSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [marketChart, setMarketChart] = useState<BotMarketChart | null>(null);
  const [marketChartError, setMarketChartError] = useState<string | null>(null);
  const [isMarketChartLoading, setIsMarketChartLoading] = useState(true);
  const [marketInterval, setMarketInterval] = useState<"15" | "60" | "240" | "D" | "W">("60");
  const [marketRange, setMarketRange] = useState<"24h" | "7d" | "30d" | "90d" | "1y" | "lifetime">("lifetime");

  const [aggregationMode, setAggregationMode] = useState<AggregationMode>(defaultOptions().mode);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const [botResult, snapshotsResult] = await Promise.all([getBot(botId), getBotSnapshots(botId)]);
        if (cancelled) return;
        const ordered = [...snapshotsResult.data].sort(
          (a, b) => new Date(a.snapshotTime).getTime() - new Date(b.snapshotTime).getTime()
        );
        setBot(botResult.data);
        setSnapshots(ordered);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [botId]);

  useEffect(() => {
    let cancelled = false;
    async function loadChart() {
      try {
        setIsMarketChartLoading(true);
        const response = await getBotMarketChart(botId, { interval: marketInterval, range: marketRange, priceSource: "market" });
        if (cancelled) return;
        setMarketChart(response.data);
        setMarketChartError(null);
      } catch (e) {
        if (!cancelled) { setMarketChart(null); setMarketChartError(toErrorMessage(e)); }
      } finally {
        if (!cancelled) setIsMarketChartLoading(false);
      }
    }
    void loadChart();
    return () => { cancelled = true; };
  }, [botId, marketInterval, marketRange]);

  const opts = defaultOptions();
  const aggregated = aggregateByTime(
    snapshots,
    (s) => new Date(s.snapshotTime).getTime(),
    { ...opts, mode: aggregationMode },
  );
  const labels = aggregated.items.map((s) => formatBinLabel(Number(aggregated.labels[aggregated.items.indexOf(s)]), aggregationMode));

  const activityDeltaSeries = aggregated.items.map((s, i) => {
    const prev = i > 0 ? aggregated.items[i - 1]?.activityCount ?? null : null;
    if (s.activityCount === null || prev === null) return null;
    return Math.max(0, s.activityCount - prev);
  });

  const annualizedGapSeries = aggregated.items.map((s) => {
    if (s.derivedAnnualizedTotalYieldRatio === null || s.gridApr === null) return null;
    return (s.derivedAnnualizedTotalYieldRatio - s.gridApr) * 100;
  });

  const latest = bot?.latestSnapshot ?? null;
  const workRuntimeSec = bot?.workRuntimeSec ?? latest?.workRuntimeSec ?? null;
  const capitalBase = latest?.investment ?? latest?.equity ?? null;
  const gridProfitCurrent = latest?.gridProfit ?? null;
  const gridProfitByRuntimePerDay =
    gridProfitCurrent === null || workRuntimeSec === null || workRuntimeSec <= 0
      ? null : gridProfitCurrent / (workRuntimeSec / 86400);
  const factTodayVsRuntime = factVsRuntimeRatio(bot?.factPnlPerDay ?? null, gridProfitByRuntimePerDay);

  return {
    botId, bot, snapshots, isLoading, error,
    marketChart, marketChartError, isMarketChartLoading, marketInterval, marketRange,
    setMarketInterval, setMarketRange,
    aggregationMode, setAggregationMode,
    opts, aggregated, labels, activityDeltaSeries, annualizedGapSeries,
    latest, workRuntimeSec, capitalBase, gridProfitCurrent, gridProfitByRuntimePerDay, factTodayVsRuntime,
  };
}
