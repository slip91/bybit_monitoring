import { useState } from "react";

import { useAsyncEffect } from "@lib/useAsyncEffect";

import { AlertsPanel, BotSpotlightCard, BotTable } from "@features/dashboard/components";
import { getAlerts, getBots, getDashboardSummary } from "@lib/api";
import { formatApr, formatDateTime, formatMoney, formatNumber, toErrorMessage, valueToneClass } from "@lib/format";
import type { AlertItem, BotListItem, DashboardSummary } from "@lib/types";
import { cn, ui } from "@lib/ui";
import { ErrorBoundary } from "@components/layout";

export function DashboardPage() {
  const [bots, setBots] = useState<BotListItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useAsyncEffect(async (signal) => {
    try {
      setIsLoading(true);
      const [botsResponse, summaryResponse, alertsResponse] = await Promise.all([
        getBots(),
        getDashboardSummary(),
        getAlerts(),
      ]);
      if (signal.aborted) return;
      setBots(botsResponse.data);
      setSummary(summaryResponse.data);
      setAlerts(alertsResponse.data);
      setError(null);
    } catch (loadError) {
      if (!signal.aborted) setError(toErrorMessage(loadError));
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, []);

  const activeBots = bots.filter((bot) => bot.status?.includes("RUNNING"));
  const bestPnlBot     = maxBy(activeBots, (b) => b.totalPnl);
  const worstPnlBot    = minBy(activeBots, (b) => b.totalPnl);
  const bestGridAprBot = maxBy(activeBots, (b) => b.gridApr);
  const mostActiveBot  = maxBy(activeBots, (b) => b.activityCount);

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка дашборда…</section>;
  }

  if (error) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  return (
    <div className="grid gap-6">
      <section className={cn(ui.panel({ tone: "hero" }), "overflow-hidden px-8 py-8")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className={ui.eyebrow()}>Обзор</p>
            <h2 className={cn(ui.heading({ size: "hero" }), "text-[clamp(1.5rem,2.2vw,2.5rem)]")}>
              Дашборд активных сеток с локальной аналитикой из SQLite.
            </h2>
          </div>
          <div className={cn(ui.pill({ tone: "success" }), "px-4 py-2 text-sm")}>
            {activeBots.length} активных бота
          </div>
        </div>
        <p className={cn(ui.heroCopy(), "mt-5")}>
          Фронтенд читает только локальный API. Это визуальный слой поверх снапшотов, диагностических подсказок и истории алертов.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            label="Суммарный капитал"
            value={formatMoney(summary?.totals.totalEquity ?? null)}
            footnote={`Последний снапшот ${formatDateTime(summary?.totals.latestSnapshotTime ?? null)}`}
            accentClass="border-[var(--color-brand-surface-lg)] bg-[linear-gradient(180deg,var(--color-brand-glow-md),var(--color-overlay-faint))]"
          />
          <DashboardKpiCard
            label="Прибыль/убыток по сеткам"
            value={formatMoney(summary?.totals.totalPnl ?? null)}
            footnote="Сумма total PnL по активным ботам"
            valueClassName={valueToneClass(summary?.totals.totalPnl ?? null)}
            accentClass="border-[var(--color-warm-glow-lg)] bg-[linear-gradient(180deg,var(--color-warm-glow-md),var(--color-overlay-faint))]"
          />
          <DashboardKpiCard
            label="Активные боты"
            value={formatNumber(activeBots.length, 0)}
            footnote={`${summary?.totals.openAlerts ?? 0} открытых алертов`}
            accentClass="border-[var(--color-green-glow-xl)] bg-[linear-gradient(180deg,var(--color-green-glow-md),var(--color-overlay-faint))]"
          />
          <DashboardKpiCard
            label="Средний APR Bybit"
            value={formatApr(summary?.totals.averageTotalApr ?? null)}
            footnote={`APR сетки ${formatApr(summary?.totals.averageGridApr ?? null)}`}
            accentClass="border-[var(--color-border-subtle)] bg-[linear-gradient(180deg,var(--color-blue-faint),var(--color-overlay-faint))]"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BotSpotlightCard title="Лучший по PnL" bot={bestPnlBot} metric="totalPnl" />
        <BotSpotlightCard title="Худший по PnL" bot={worstPnlBot} metric="totalPnl" />
        <BotSpotlightCard title="Лучшая доходность сетки" bot={bestGridAprBot} metric="gridApr" />
        <BotSpotlightCard title="Самая активная сетка" bot={mostActiveBot} metric="activityCount" />
      </section>

      <ErrorBoundary><BotTable bots={activeBots} /></ErrorBoundary>
      <ErrorBoundary><AlertsPanel alerts={alerts} /></ErrorBoundary>
    </div>
  );
}

type DashboardKpiCardProps = {
  label: string;
  value: string;
  footnote: string;
  accentClass: string;
  valueClassName?: string;
};

function DashboardKpiCard({ label, value, footnote, accentClass, valueClassName = "" }: DashboardKpiCardProps) {
  return (
    <article className={cn(ui.card({ subtle: true }), "border px-5 py-5 shadow-[inset_0_1px_0_var(--color-overlay-faint)] backdrop-blur-sm", accentClass)}>
      <p className={ui.subtitle()}>{label}</p>
      <strong className={cn("mt-3 block text-[2rem] leading-none tracking-[-0.03em]", valueClassName)}>
        {value}
      </strong>
      <p className={cn("mt-3 text-sm leading-6", ui.subtitle())}>{footnote}</p>
    </article>
  );
}

function maxBy<T>(arr: Array<T>, key: (item: T) => number | null | undefined): T | null {
  return arr.reduce<T | null>((best, item) => {
    const v = key(item) ?? -Infinity;
    return best === null || v > (key(best) ?? -Infinity) ? item : best;
  }, null);
}

function minBy<T>(arr: Array<T>, key: (item: T) => number | null | undefined): T | null {
  return arr.reduce<T | null>((best, item) => {
    const v = key(item) ?? Infinity;
    return best === null || v < (key(best) ?? Infinity) ? item : best;
  }, null);
}
