import { useMemo } from 'react';

import { AlertsPanel } from '../components/AlertsPanel';
import { BotSpotlightCard } from '../components/BotSpotlightCard';
import { BotTable } from '../components/BotTable';
import { TableSkeleton } from '../components/Skeleton';
import { useBots } from '../hooks/useBots';
import { useDashboardSummary, useAlerts } from '../hooks/useDashboard';
import { formatApr, formatDateTime, formatMoney, valueToneClass } from '../lib/format';
import { cn, ui } from '../lib/ui';

function DashboardKpiCard({
  label,
  value,
  footnote,
  accentClass,
}: {
  label: string;
  value: string;
  footnote?: string;
  accentClass?: string;
}) {
  return (
    <div className={cn('rounded-xl border p-5', accentClass)}>
      <p className="mb-2 text-sm text-[var(--color-text-muted)]">{label}</p>
      <strong className="block text-2xl font-semibold">{value}</strong>
      {footnote && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{footnote}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { data: bots, isLoading: botsLoading, error: botsError } = useBots();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: alerts, isLoading: alertsLoading } = useAlerts();

  const activeBots = useMemo(() => bots?.filter((bot) => bot.status?.includes('RUNNING')) ?? [], [bots]);

  const bestPnlBot = useMemo(
    () => activeBots.reduce((best, bot) => ((bot.totalPnl ?? 0) > (best.totalPnl ?? 0) ? bot : best), activeBots[0]),
    [activeBots]
  );

  const worstPnlBot = useMemo(
    () => activeBots.reduce((worst, bot) => ((bot.totalPnl ?? 0) < (worst.totalPnl ?? 0) ? bot : worst), activeBots[0]),
    [activeBots]
  );

  const bestGridAprBot = useMemo(
    () => activeBots.reduce((best, bot) => ((bot.gridApr ?? 0) > (best.gridApr ?? 0) ? bot : best), activeBots[0]),
    [activeBots]
  );

  const mostActiveBot = useMemo(
    () =>
      activeBots.reduce(
        (most, bot) => ((bot.activityCount ?? 0) > (most.activityCount ?? 0) ? bot : most),
        activeBots[0]
      ),
    [activeBots]
  );

  if (botsError) {
    return (
      <section className={cn(ui.panel(), 'border-[var(--color-error-border)] px-8 py-7')}>
        Ошибка загрузки: {botsError}
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className={cn(ui.panel({ tone: 'hero' }), 'overflow-hidden px-8 py-8')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className={ui.eyebrow()}>Обзор</p>
            <h2 className={cn(ui.heading({ size: 'hero' }), 'text-[clamp(1.5rem,2.2vw,2.5rem)]')}>
              Дашборд активных сеток с локальной аналитикой из SQLite.
            </h2>
          </div>
          <div className={cn(ui.pill({ tone: 'success' }), 'px-4 py-2 text-sm')}>
            {activeBots.length} активных бота
          </div>
        </div>
        <p className={cn(ui.heroCopy(), 'mt-5')}>
          Фронтенд читает только локальный API. Это визуальный слой поверх снапшотов, диагностических подсказок и
          истории алертов.
        </p>

        {summaryLoading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              label="Суммарный капитал"
              value={formatMoney(summary?.totals.totalEquity ?? null)}
              footnote={`Последний снапшот ${formatDateTime(summary?.totals.latestSnapshotTime ?? null)}`}
              accentClass="border-[rgba(84,208,200,0.22)] bg-[linear-gradient(180deg,rgba(84,208,200,0.12),rgba(255,255,255,0.03))]"
            />
            <DashboardKpiCard
              label="Прибыль/убыток по сеткам"
              value={formatMoney(summary?.totals.totalPnl ?? null)}
              footnote={`Средний APR ${formatApr(summary?.totals.avgGridApr ?? null)}`}
              accentClass={cn(
                'border-[rgba(84,208,200,0.22)]',
                valueToneClass(summary?.totals.totalPnl ?? null)
              )}
            />
            <DashboardKpiCard
              label="Активных ботов"
              value={String(summary?.statusBreakdown.running ?? 0)}
              footnote={`Всего ${summary?.totals.totalBots ?? 0} ботов`}
              accentClass="border-[rgba(147,197,253,0.22)] bg-[linear-gradient(180deg,rgba(147,197,253,0.12),rgba(255,255,255,0.03))]"
            />
            <DashboardKpiCard
              label="Открытых алертов"
              value={String(summary?.totals.openAlerts ?? 0)}
              accentClass="border-[rgba(251,191,36,0.22)] bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(255,255,255,0.03))]"
            />
          </div>
        )}
      </section>

      {!botsLoading && activeBots.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bestPnlBot && <BotSpotlightCard bot={bestPnlBot} metric="totalPnl" label="Лучший по PnL" />}
          {worstPnlBot && <BotSpotlightCard bot={worstPnlBot} metric="totalPnl" label="Худший по PnL" />}
          {bestGridAprBot && <BotSpotlightCard bot={bestGridAprBot} metric="gridApr" label="Лучший Grid APR" />}
          {mostActiveBot && <BotSpotlightCard bot={mostActiveBot} metric="activityCount" label="Самый активный" />}
        </section>
      )}

      {botsLoading ? <TableSkeleton rows={5} /> : bots && <BotTable bots={bots} />}

      {alertsLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-gray-200" />
      ) : (
        alerts && <AlertsPanel alerts={alerts} />
      )}
    </div>
  );
}
