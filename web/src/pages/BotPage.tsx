import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { BarChart, ChartCard, LineChart } from "../components/ui";
import { BotMarketChart } from "../features/bots/components";
import { StatCard } from "../features/dashboard/components";
import { getBot, getBotMarketChart, getBotSnapshots } from "../lib/api";
import { aggregateByTime, aggregationPeriodLabel, defaultOptions, formatBinLabel } from "../lib/aggregate";
import type { AggregationMode } from "../lib/aggregate";
import {
  annualizedStatusLabel,
  factVsRuntimeRatio,
  factVsRuntimeToneClass,
  formatAnnualizedYield,
  formatApr,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPercent,
  statusHintLabel,
  statusHintDescription,
  statusLabel,
  toErrorMessage,
  valueToneClass,
} from "../lib/format";
import type { BotDetails, BotMarketChart as BotMarketChartData, BotSnapshot } from "../lib/types";
import { cn, ui } from "../lib/ui";

export function BotPage() {
  const { botId = "" } = useParams();
  const [bot, setBot] = useState<BotDetails | null>(null);
  const [marketChart, setMarketChart] = useState<BotMarketChartData | null>(null);
  const [marketChartError, setMarketChartError] = useState<string | null>(null);
  const [isMarketChartLoading, setIsMarketChartLoading] = useState(true);
  const [marketInterval, setMarketInterval] = useState<"15" | "60" | "240" | "D" | "W">("60");
  const [marketRange, setMarketRange] = useState<"24h" | "7d" | "30d" | "90d" | "1y" | "lifetime">("lifetime");
  const [snapshots, setSnapshots] = useState<BotSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>(defaultOptions().mode);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const [botResult, snapshotsResult] = await Promise.all([
          getBot(botId),
          getBotSnapshots(botId),
        ]);

        if (cancelled) return;

        const orderedSnapshots = [...snapshotsResult.data].sort(
          (l, r) => new Date(l.snapshotTime).getTime() - new Date(r.snapshotTime).getTime()
        );

        setBot(botResult.data);
        setSnapshots(orderedSnapshots);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [botId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketChart() {
      try {
        setIsMarketChartLoading(true);
        const response = await getBotMarketChart(botId, {
          interval: marketInterval,
          range: marketRange,
          priceSource: "market",
        });
        if (cancelled) {
          return;
        }

        setMarketChart(response.data);
        setMarketChartError(null);
      } catch (loadError) {
        if (!cancelled) {
          setMarketChart(null);
          setMarketChartError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsMarketChartLoading(false);
        }
      }
    }

    void loadMarketChart();
    return () => {
      cancelled = true;
    };
  }, [botId, marketInterval, marketRange]);

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка истории бота…</section>;
  }

  if (error || !bot) {
    return <section className={cn(ui.panel(), "border-[rgba(255,106,119,0.22)] px-8 py-7")}>{error || "Бот не найден."}</section>;
  }

  const opts = defaultOptions();
  const aggregated = aggregateByTime(
    snapshots,
    (s) => new Date(s.snapshotTime).getTime(),
    { ...opts, mode: aggregationMode },
  );
  const labels = aggregated.items.map((snapshot) => formatBinLabel(Number(aggregated.labels[aggregated.items.indexOf(snapshot)]), aggregationMode));
  const activityDeltaSeries = aggregated.items.map((snapshot, index) => {
    const current = snapshot.activityCount;
    const previous = index > 0 ? aggregated.items[index - 1]?.activityCount ?? null : null;

    if (current === null) {
      return null;
    }

    if (previous === null) {
      return null;
    }

    return Math.max(0, current - previous);
  });
  const latestActivityDelta = activityDeltaSeries[activityDeltaSeries.length - 1] ?? null;
  const recentTrades24h = sumRecentActivityDeltas(aggregated.items, activityDeltaSeries, 24);
  const annualizedGapSeries = aggregated.items.map((snapshot) => {
    if (snapshot.derivedAnnualizedTotalYieldRatio === null || snapshot.gridApr === null) {
      return null;
    }

    return (snapshot.derivedAnnualizedTotalYieldRatio - snapshot.gridApr) * 100;
  });
  const annualizedGapColors = annualizedGapSeries.map((value) => {
    if (value === null) {
      return "#6f8593";
    }

    return value >= 0 ? "#7ee787" : "#ff9b71";
  });
  const latest = bot.latestSnapshot;
  const workRuntimeSec = bot.workRuntimeSec ?? latest?.workRuntimeSec ?? null;
  const capitalBase = latest?.investment ?? latest?.equity ?? null;
  const gridProfitCurrent = latest?.gridProfit ?? null;
  const gridProfitByRuntimePerDay =
    gridProfitCurrent === null || workRuntimeSec === null || workRuntimeSec <= 0
      ? null
      : gridProfitCurrent / (workRuntimeSec / 86400);
  const runtimeIncomePer100Usd =
    gridProfitByRuntimePerDay === null || latest?.equity === null || latest?.equity === undefined || latest.equity <= 0
      ? null
      : (gridProfitByRuntimePerDay / latest.equity) * 100;
  const estimatedDailyYieldRatio = latest?.gridApr === null || latest?.gridApr === undefined ? null : latest.gridApr / 365;
  const gridYieldByRuntimePerDay =
    gridProfitByRuntimePerDay === null || capitalBase === null || capitalBase <= 0
      ? null
      : gridProfitByRuntimePerDay / capitalBase;
  const actualDailyYieldRatio =
    bot.factPnlPerDay === null || capitalBase === null || capitalBase <= 0 ? null : bot.factPnlPerDay / capitalBase;
  const factTodayVsRuntime = factVsRuntimeRatio(bot.factPnlPerDay, gridProfitByRuntimePerDay);

  return (
    <div className={ui.page()}>
      <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
        <Link className={cn(ui.button({ tone: "ghost" }), "inline-flex w-fit")} to="/">
          ← Назад к дашборду
        </Link>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={ui.eyebrow()}>Карточка бота</p>
            <h2 className={cn(ui.heading({ size: "hero" }), "flex items-center gap-2")}>
              <span>{bot.symbol || bot.id}</span>
              {bot.leverage !== null && <span className={ui.leverageBadge()}>x{bot.leverage}</span>}
            </h2>
            <p className={ui.heroCopy()}>
              {statusLabel(bot.status)} · {bot.botType || "неизвестно"} · Последняя активность {formatDateTime(bot.lastSeenAt)}
            </p>
          </div>
          <span
            className={botStatusPillClassName(latest?.statusHint || "unknown")}
            title={statusHintDescription(latest?.statusHint || "unknown")}
            aria-label={statusHintDescription(latest?.statusHint || "unknown")}
          >
            {statusHintLabel(latest?.statusHint || "unknown")}
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Последний капитал" value={formatMoney(latest?.equity ?? null)} tone="cool" />
          <StatCard
            label="Последняя прибыль/убыток"
            value={formatMoney(latest?.totalPnl ?? null)}
            tone="warm"
            valueClassName={valueToneClass(latest?.totalPnl ?? null)}
          />
          <StatCard
            label="Время работы"
            value={formatDuration(workRuntimeSec)}
            labelHint={`Наблюдаем локально ${formatDuration(bot.runtimeSec)} · старт ${formatDateTime(bot.runtimeStartedAt)}`}
            footnote={bot.workStartedAt ? `Старт на Bybit ${formatDateTime(bot.workStartedAt)}` : undefined}
          />
          <StatCard
            label="Прибыль сетки сейчас"
            value={formatMoney(gridProfitCurrent)}
            footnote={
              gridProfitByRuntimePerDay === null
                ? "Это текущее поле grid_profit из последнего snapshot, не дневная метрика"
                : `По текущему runtime это около ${formatMoney(gridProfitByRuntimePerDay)} в день`
            }
          />
        </div>
      </section>

      <section className={cn(ui.panel(), "p-6")}>
        <div className={ui.sectionHeader()}>
          <div>
            <p className={ui.eyebrow()}>Доходность</p>
            <h2 className={ui.heading()}>Доходность в день</h2>
          </div>
        </div>
        <div className={ui.statsGrid()}>
          <StatCard
            label="Годовая по факту"
            value={formatAnnualizedYield(bot.derivedAnnualizedTotalYieldRatio, bot.derivedAnnualizedStatus)}
            valueClassName={valueToneClass(bot.derivedAnnualizedTotalYieldRatio)}
            footnote={
              bot.annualizedCapitalBase === null || bot.annualizedRuntimeDays === null
                ? annualizedStatusLabel(bot.derivedAnnualizedStatus)
                : `${annualizedStatusLabel(bot.derivedAnnualizedStatus)} · база ${formatMoney(bot.annualizedCapitalBase)} · runtime ${formatNumber(bot.annualizedRuntimeDays, 3)} д`
            }
          />
          <StatCard label="Bybit total APR" value={formatApr(latest?.totalApr ?? null)} footnote="Сырым полем приходит от Bybit" />
          <StatCard label="Bybit grid APR" value={formatApr(latest?.gridApr ?? null)} footnote="APR сетки из ответа Bybit" />
          <StatCard
            label="Сетка по runtime/день"
            value={formatMoney(gridProfitByRuntimePerDay)}
            footnote="Текущий grid_profit / время работы бота на Bybit"
          />
          <StatCard
            label="На 100 $/день"
            value={formatMoney(runtimeIncomePer100Usd)}
            footnote="Та же runtime-метрика, нормализованная на 100 $ текущего капитала"
          />
          <StatCard
            label="APR-оценка/день"
            value={formatMoney(bot.gridProfitPerDay)}
            footnote="Расчетная сумма в день по grid APR и капиталу"
          />
          <StatCard
            label="Факт сегодня"
            value={formatMoney(bot.factPnlPerDay)}
            valueClassName={valueToneClass(bot.factPnlPerDay)}
            footnote={
              <>
                <span>Сколько grid_profit добавилось с 00:00 текущего дня</span>
                <span
                  className={cn("font-medium", factVsRuntimeToneClass(factTodayVsRuntime))}
                  title="Процент от По runtime/день"
                  aria-label="Процент от По runtime/день"
                >
                  {formatPercent(factTodayVsRuntime, 0)}
                </span>
              </>
            }
          />
          <StatCard
            label="Доходность сетки/день"
            value={formatPercent(gridYieldByRuntimePerDay === null ? null : gridYieldByRuntimePerDay * 100, 3)}
            footnote={capitalBase === null ? "Нет базы капитала для нормализации" : `База капитала ${formatMoney(capitalBase)}`}
          />
          <StatCard
            label="Фактическая доходность сегодня"
            value={formatPercent(actualDailyYieldRatio === null ? null : actualDailyYieldRatio * 100, 3)}
            footnote="Факт с начала дня / текущая база капитала"
          />
          <StatCard
            label="APR-доходность/день"
            value={formatPercent(estimatedDailyYieldRatio === null ? null : estimatedDailyYieldRatio * 100, 3)}
            footnote="Оценка по grid APR, а не по фактически накопленной прибыли"
          />
        </div>
      </section>

      <ChartCard
        title="Рыночная цена и диапазон сетки"
        eyebrow="Market Context"
        aside={marketChart ? `Kline ${intervalLabel(marketChart.interval)} · ${rangeLabel(marketChart.range)}` : undefined}
      >
        <div className="mb-4 grid gap-3">
          <div className="flex flex-wrap gap-2">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  ui.pill(marketInterval === option.value ? { tone: "brand" } : undefined),
                  "px-4 py-2 text-sm normal-case tracking-normal"
                )}
                onClick={() => setMarketInterval(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  ui.pill(marketRange === option.value ? { tone: "brand" } : undefined),
                  "px-4 py-2 text-sm normal-case tracking-normal"
                )}
                onClick={() => setMarketRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isMarketChartLoading ? (
          <div className={ui.emptyState()}>Загрузка рыночной истории…</div>
        ) : marketChart ? (
          <BotMarketChart data={marketChart} totalPnl={latest?.totalPnl ?? null} gridProfit={gridProfitCurrent} />
        ) : (
          <div className={ui.emptyState()}>
            {marketChartError || "Рыночный график пока недоступен. Метрики бота остаются доступны отдельно."}
          </div>
        )}
      </ChartCard>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cn(
            ui.pill(aggregationMode === "recent" ? { tone: "brand" } : undefined),
            "px-4 py-2 text-sm normal-case tracking-normal"
          )}
          onClick={() => setAggregationMode("recent")}
        >
          Последние {opts.recentCount}
        </button>
        <button
          type="button"
          className={cn(
            ui.pill(aggregationMode === "30d" ? { tone: "brand" } : undefined),
            "px-4 py-2 text-sm normal-case tracking-normal"
          )}
          onClick={() => setAggregationMode("30d")}
        >
          30 дней
        </button>
        <button
          type="button"
          className={cn(
            ui.pill(aggregationMode === "full" ? { tone: "brand" } : undefined),
            "px-4 py-2 text-sm normal-case tracking-normal"
          )}
          onClick={() => setAggregationMode("full")}
        >
          Всё время{aggregationMode === "full" && snapshots.length > opts.maxBins ? ` · ~${opts.maxBins} точек` : ""}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="История капитала" eyebrow="Баланс" aside={aggregationPeriodLabel(aggregationMode, aggregated.items.length, snapshots.length)}>
          <LineChart
            labels={labels}
            series={[{ label: "Капитал", color: "#4ed0c3", values: aggregated.items.map((item) => item.equity) }]}
            valueFormatter={(value) => formatMoney(value)}
          />
        </ChartCard>

        <ChartCard title="История прибыли и убытка" eyebrow="Результат" aside={`Просадка ${formatMoney(latest?.drawdownFromLocalPeak ?? null)}`}>
          <LineChart
            labels={labels}
            series={[
              {
                label: "Прибыль/убыток",
                color: "#ff8f5a",
                positiveColor: "#7ee787",
                values: aggregated.items.map((item) => item.totalPnl),
              }
            ]}
            valueFormatter={(value) => formatMoney(value)}
          />
        </ChartCard>

        <ChartCard
          title="Разница факта и APR сетки Bybit"
          eyebrow="Сравнение доходности"
          aside={`Текущий разрыв ${formatPercent((bot.derivedAnnualizedTotalYieldRatio !== null && latest?.gridApr != null ? (bot.derivedAnnualizedTotalYieldRatio - latest.gridApr) * 100 : null), 2)}`}
        >
          <BarChart
            labels={labels}
            series={[
              {
                label: "Факт - APR Bybit",
                color: annualizedGapColors,
                values: annualizedGapSeries,
              }
            ]}
            valueFormatter={(value) => formatPercent(value, 2)}
          />
        </ChartCard>

        <ChartCard
          title="Сделки по интервалам"
          eyebrow="Ритм"
          aside={`Последний интервал ${formatNumber(latestActivityDelta, 0)} · 24ч ${formatNumber(recentTrades24h, 0)}`}
        >
          <LineChart
            labels={labels}
            series={[{ label: "Δ сделок", color: "#a6f05a", positiveColor: "#d9ff7a", values: activityDeltaSeries }]}
            valueFormatter={(value) => formatNumber(value, 0)}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function botStatusPillClassName(value: string) {
  if (value === "strong")                          return ui.pill({ tone: "success" });
  if (value === "weak" || value === "high_drawdown") return ui.pill({ tone: "stale" });
  if (value === "critical")                        return ui.pill({ tone: "error" });
  return ui.pill();
}


const INTERVAL_OPTIONS = [
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "1d" },
  { value: "W", label: "1w" },
] as const;

const RANGE_OPTIONS = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
  { value: "lifetime", label: "bot lifetime" },
] as const;

function intervalLabel(value: string) {
  const option = INTERVAL_OPTIONS.find((item) => item.value === value);
  return option?.label || value;
}

function rangeLabel(value: string) {
  const option = RANGE_OPTIONS.find((item) => item.value === value);
  return option?.label || value;
}

function sumRecentActivityDeltas<T extends { snapshotTime: string }>(
  snapshots: T[],
  deltas: Array<number | null>,
  hours: number,
) {
  const latestTime = snapshots[snapshots.length - 1]?.snapshotTime;
  if (!latestTime) {
    return null;
  }

  const latestTimestamp = new Date(latestTime).getTime();
  if (Number.isNaN(latestTimestamp)) {
    return null;
  }

  const threshold = latestTimestamp - hours * 60 * 60 * 1000;
  let total = 0;
  let hasValues = false;

  snapshots.forEach((snapshot, index) => {
    const timestamp = new Date(snapshot.snapshotTime).getTime();
    const delta = deltas[index];
    if (Number.isNaN(timestamp) || delta === null || timestamp < threshold) {
      return;
    }

    total += delta;
    hasValues = true;
  });

  return hasValues ? total : null;
}
