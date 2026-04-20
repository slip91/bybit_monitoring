import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

import { BarChart, ChartCard, LineChart } from "@components/ui";
import { ErrorBoundary } from "@components/layout";
import { CardSkeleton, TableSkeleton } from "@components/ui";
const BotMarketChart = lazy(() => import("@features/bots/components/BotMarketChart").then(m => ({ default: m.BotMarketChart })));
import { StatCard } from "@features/dashboard/components";
import { useBotPage } from "@features/bots/hooks/useBotPage";
import { aggregationPeriodLabel } from "@lib/aggregate";
import {
  annualizedStatusLabel,
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
  valueToneClass,
} from "@lib/format";
import { cn, ui } from "@lib/ui";

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

export function BotPage() {
  const {
    bot, isLoading, error,
    marketChart, marketChartError, isMarketChartLoading, marketInterval, marketRange,
    setMarketInterval, setMarketRange,
    aggregationMode, setAggregationMode,
    opts, aggregated, labels, activityDeltaSeries, annualizedGapSeries,
    latest, workRuntimeSec, capitalBase, gridProfitCurrent, gridProfitByRuntimePerDay, factTodayVsRuntime,
    snapshots,
  } = useBotPage();

  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <CardSkeleton />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !bot) {
    return <section className={cn(ui.panel(), "border-[rgba(255,106,119,0.22)] px-8 py-7")}>{error || "Бот не найден."}</section>;
  }

  const latestActivityDelta = activityDeltaSeries[activityDeltaSeries.length - 1] ?? null;
  const recentTrades24h = sumRecentActivityDeltas(aggregated.items, activityDeltaSeries, 24);
  const annualizedGapColors = annualizedGapSeries.map((v) => v === null ? "#6f8593" : v >= 0 ? "#7ee787" : "#ff9b71");

  const runtimeIncomePer100Usd =
    gridProfitByRuntimePerDay === null || !latest?.equity || latest.equity <= 0
      ? null : (gridProfitByRuntimePerDay / latest.equity) * 100;
  const estimatedDailyYieldRatio = latest?.gridApr == null ? null : latest.gridApr / 365;
  const gridYieldByRuntimePerDay =
    gridProfitByRuntimePerDay === null || capitalBase === null || capitalBase <= 0
      ? null : gridProfitByRuntimePerDay / capitalBase;
  const actualDailyYieldRatio =
    bot.factPnlPerDay === null || capitalBase === null || capitalBase <= 0 ? null : bot.factPnlPerDay / capitalBase;

  return (
    <div className={ui.page()}>
      <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
        <button type="button" className={cn(ui.button({ tone: "ghost" }), "inline-flex w-fit")} onClick={() => navigate(-1)}>← Назад</button>
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
          >
            {statusHintLabel(latest?.statusHint || "unknown")}
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Последний капитал" value={formatMoney(latest?.equity ?? null)} tone="cool" />
          <StatCard label="Последняя прибыль/убыток" value={formatMoney(latest?.totalPnl ?? null)} tone="warm" valueClassName={valueToneClass(latest?.totalPnl ?? null)} />
          <StatCard
            label="Время работы"
            value={formatDuration(workRuntimeSec)}
            labelHint={`Наблюдаем локально ${formatDuration(bot.runtimeSec)} · старт ${formatDateTime(bot.runtimeStartedAt)}`}
            footnote={bot.workStartedAt ? `Старт на Bybit ${formatDateTime(bot.workStartedAt)}` : undefined}
          />
          <StatCard
            label="Прибыль сетки сейчас"
            value={formatMoney(gridProfitCurrent)}
            footnote={gridProfitByRuntimePerDay === null ? "Текущее поле grid_profit из последнего snapshot" : `По текущему runtime это около ${formatMoney(gridProfitByRuntimePerDay)} в день`}
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
          <StatCard label="Сетка по runtime/день" value={formatMoney(gridProfitByRuntimePerDay)} footnote="Текущий grid_profit / время работы бота на Bybit" />
          <StatCard label="На 100 $/день" value={formatMoney(runtimeIncomePer100Usd)} footnote="Runtime-метрика, нормализованная на 100 $ текущего капитала" />
          <StatCard label="APR-оценка/день" value={formatMoney(bot.gridProfitPerDay)} footnote="Расчетная сумма в день по grid APR и капиталу" />
          <StatCard
            label="Факт сегодня"
            value={formatMoney(bot.factPnlPerDay)}
            valueClassName={valueToneClass(bot.factPnlPerDay)}
            footnote={
              <>
                <span>Сколько grid_profit добавилось с 00:00 текущего дня</span>
                <span className={cn("font-medium", factVsRuntimeToneClass(factTodayVsRuntime))} title="Процент от По runtime/день" aria-label="Процент от По runtime/день">
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
          <StatCard label="Фактическая доходность сегодня" value={formatPercent(actualDailyYieldRatio === null ? null : actualDailyYieldRatio * 100, 3)} footnote="Факт с начала дня / текущая база капитала" />
          <StatCard label="APR-доходность/день" value={formatPercent(estimatedDailyYieldRatio === null ? null : estimatedDailyYieldRatio * 100, 3)} footnote="Оценка по grid APR, а не по фактически накопленной прибыли" />
        </div>
      </section>

      <ErrorBoundary>
        <ChartCard
          title="Рыночная цена и диапазон сетки"
          eyebrow="Market Context"
          aside={marketChart ? `Kline ${labelOf(INTERVAL_OPTIONS, marketChart.interval)} · ${labelOf(RANGE_OPTIONS, marketChart.range)}` : undefined}
        >
          <div className="mb-4 grid gap-3">
            <div className="flex flex-wrap gap-2">
              {INTERVAL_OPTIONS.map((o) => (
                <button key={o.value} type="button" className={cn(ui.pill(marketInterval === o.value ? { tone: "brand" } : undefined), "px-4 py-2 text-sm normal-case tracking-normal")} onClick={() => setMarketInterval(o.value)}>{o.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((o) => (
                <button key={o.value} type="button" className={cn(ui.pill(marketRange === o.value ? { tone: "brand" } : undefined), "px-4 py-2 text-sm normal-case tracking-normal")} onClick={() => setMarketRange(o.value)}>{o.label}</button>
              ))}
            </div>
          </div>
          {isMarketChartLoading ? (
            <div className={ui.emptyState()}>Загрузка рыночной истории…</div>
          ) : marketChart ? (
            <Suspense fallback={<div className={ui.emptyState()}>Загрузка графика…</div>}>
              <BotMarketChart data={marketChart} totalPnl={latest?.totalPnl ?? null} gridProfit={gridProfitCurrent} />
            </Suspense>
          ) : (
            <div className={ui.emptyState()}>{marketChartError || "Рыночный график пока недоступен."}</div>
          )}
        </ChartCard>
      </ErrorBoundary>

      <div className="flex items-center gap-3">
        {([["recent", `Последние ${opts.recentCount}`], ["30d", "30 дней"], ["full", `Всё время${aggregationMode === "full" && snapshots.length > opts.maxBins ? ` · ~${opts.maxBins} точек` : ""}`]] as const).map(([mode, label]) => (
          <button key={mode} type="button" className={cn(ui.pill(aggregationMode === mode ? { tone: "brand" } : undefined), "px-4 py-2 text-sm normal-case tracking-normal")} onClick={() => setAggregationMode(mode)}>{label}</button>
        ))}
      </div>

      <ErrorBoundary>
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="История капитала" eyebrow="Баланс" aside={aggregationPeriodLabel(aggregationMode, aggregated.items.length, snapshots.length)}>
            <LineChart labels={labels} series={[{ label: "Капитал", color: "#4ed0c3", values: aggregated.items.map((s) => s.equity) }]} valueFormatter={(v) => formatMoney(v)} />
          </ChartCard>
          <ChartCard title="История прибыли и убытка" eyebrow="Результат" aside={`Просадка ${formatMoney(latest?.drawdownFromLocalPeak ?? null)}`}>
            <LineChart labels={labels} series={[{ label: "Прибыль/убыток", color: "#ff8f5a", positiveColor: "#7ee787", values: aggregated.items.map((s) => s.totalPnl) }]} valueFormatter={(v) => formatMoney(v)} />
          </ChartCard>
          <ChartCard
            title="Разница факта и APR сетки Bybit"
            eyebrow="Сравнение доходности"
            aside={`Текущий разрыв ${formatPercent((bot.derivedAnnualizedTotalYieldRatio !== null && latest?.gridApr != null ? (bot.derivedAnnualizedTotalYieldRatio - latest.gridApr) * 100 : null), 2)}`}
          >
            <BarChart labels={labels} series={[{ label: "Факт - APR Bybit", color: annualizedGapColors, values: annualizedGapSeries }]} valueFormatter={(v) => formatPercent(v, 2)} />
          </ChartCard>
          <ChartCard title="Сделки по интервалам" eyebrow="Ритм" aside={`Последний интервал ${formatNumber(latestActivityDelta, 0)} · 24ч ${formatNumber(recentTrades24h, 0)}`}>
            <LineChart labels={labels} series={[{ label: "Δ сделок", color: "#a6f05a", positiveColor: "#d9ff7a", values: activityDeltaSeries }]} valueFormatter={(v) => formatNumber(v, 0)} />
          </ChartCard>
        </div>
      </ErrorBoundary>
    </div>
  );
}

function botStatusPillClassName(value: string) {
  if (value === "strong") return ui.pill({ tone: "success" });
  if (value === "weak" || value === "high_drawdown") return ui.pill({ tone: "stale" });
  if (value === "critical") return ui.pill({ tone: "error" });
  return ui.pill();
}

function labelOf<T extends { value: string; label: string }>(options: readonly T[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function sumRecentActivityDeltas<T extends { snapshotTime: string }>(snapshots: T[], deltas: Array<number | null>, hours: number) {
  const latest = snapshots[snapshots.length - 1]?.snapshotTime;
  if (!latest) return null;
  const latestTs = new Date(latest).getTime();
  if (Number.isNaN(latestTs)) return null;
  const threshold = latestTs - hours * 3600_000;
  let total = 0, hasValues = false;
  snapshots.forEach((s, i) => {
    const ts = new Date(s.snapshotTime).getTime();
    const d = deltas[i];
    if (Number.isNaN(ts) || d == null || ts < threshold) return;
    total += d; hasValues = true;
  });
  return hasValues ? total : null;
}
