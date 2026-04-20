import { cn, ui } from "../../../lib/ui";
import { StatCard } from "../../dashboard/components/StatCard";
import { formatNumber, formatMoney, valueToneClass, coverageStatusLabel } from "../../../lib/format";
import type { ClosedBotsHistory } from "../../../lib/types";

type Props = {
  history: ClosedBotsHistory | null;
};

export function ClosedBotsHeader({ history }: Props) {
  return (
    <>
      <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
        <p className={ui.eyebrow()}>История стратегии</p>
        <h2 className={ui.heading({ size: "hero" })}>Закрытые боты</h2>
        <p className={ui.heroCopy()}>
          Это отдельная витрина для закрытых ботов. Она не участвует в расчете текущего плана дохода и нужна только
          для истории, реализованной прибыли, итогового результата и будущей аналитики стратегии.
        </p>

        <div className={ui.statsGrid()}>
          <StatCard label="Закрытых ботов" value={formatNumber(history?.summary.closedBotsCount ?? 0, 0)} tone="cool" />
          <StatCard
            label="Исключено из истории"
            value={formatNumber(history?.summary.excludedRunsCount ?? 0, 0)}
            footnote="Исключенные запуски не удаляются, а просто не входят в расчетные метрики этой страницы"
          />
          <StatCard
            label="Реализованная прибыль"
            value={formatClosedRealizedSummary(history)}
            footnote={describeRealizedSummary(history)}
          />
          <StatCard
            label={history?.summary.usesFinalPnlProxy ? "Итоговая прибыль как proxy" : "Итоговая прибыль"}
            value={formatMoney(history?.summary.totalFinalPnl ?? null)}
            footnote={
              history?.summary.usesFinalPnlProxy
                ? "Используется как proxy, когда источник не дает полный realized breakdown"
                : "Сводная итоговая прибыль по закрытым запускам"
            }
          />
          <StatCard label="Плюсовых" value={formatNumber(history?.summary.profitableClosedBots ?? 0, 0)} />
          <StatCard label="Убыточных" value={formatNumber(history?.summary.losingClosedBots ?? 0, 0)} />
          <StatCard
            label="Средняя прибыль на 100 долларов"
            value={formatMoney(history?.summary.avgPnlPer100Usd ?? null)}
            footnote="Считается как итоговая прибыль, деленная на суммарную инвестицию закрытых запусков, и нормализуется к 100 долларам. Это не метрика текущего плана."
          />
          <StatCard
            label="Средняя прибыль/день"
            value={formatMoney(history?.summary.avgPnlPerDay ?? null)}
            valueClassName={valueToneClass(history?.summary.avgPnlPerDay ?? null)}
            footnote={describeClosedAveragePnlPerDay(history)}
          />
          <StatCard
            label="Средняя длительность"
            value={formatLifetimeSummary(history)}
            footnote={describeCoverageField("lifetime", history)}
          />
        </div>
      </section>

      <section className={cn(ui.panel(), "p-6")}>
        <div className={ui.sectionHeader()}>
          <div>
            <p className={ui.eyebrow()}>Покрытие</p>
            <h2 className={ui.heading()}>Насколько история уже пригодна для аналитики</h2>
          </div>
        </div>
        <div className={ui.statsGrid()}>
          <StatCard
            label="Покрытие реализованной прибыли"
            value={coverageStatusLabel(history?.summary.realizedPnlStatus)}
            footnote={describeCoverageField("realized", history)}
          />
          <StatCard
            label="Покрытие длительности"
            value={coverageStatusLabel(history?.summary.lifetimeStatus)}
            footnote={describeCoverageField("lifetime", history)}
          />
          <StatCard
            label="Покрытие причины закрытия"
            value={coverageStatusLabel(history?.summary.closeReasonStatus)}
            footnote={describeCoverageField("closeReason", history)}
          />
          <StatCard
            label="Покрытие тега стратегии"
            value={coverageStatusLabel(history?.summary.strategyTagStatus)}
            footnote={describeCoverageField("strategyTag", history)}
          />
        </div>
        <div className={cn(ui.note({ tone: "warning" }), "mt-4")}>
          Поля `lifetime`, `closeReason` и `strategyTag` пока зависят от того, что реально приходит из source и что уже
          успели восстановить в warehouse. Здесь важно покрытие, а не иллюзия полноты.
        </div>
      </section>
    </>
  );
}

// Helper functions
function formatClosedRealizedSummary(history: ClosedBotsHistory | null) {
  if (!history) return "н/д";
  if (history.summary.realizedPnlStatus === "unavailable") return "Источник не отдал";
  if (history.summary.realizedPnlStatus === "incomplete" && history.summary.totalRealizedPnl === null) return "Неполное покрытие";
  return formatMoney(history.summary.totalRealizedPnl ?? null);
}

function describeRealizedSummary(history: ClosedBotsHistory | null) {
  if (!history) return null;
  const coverage = `${((history.summary.realizedPnlCoverageRatio ?? 0) * 100).toFixed(0)}%`;
  if (history.summary.realizedPnlStatus === "available") return `Покрытие реализованной прибыли: ${coverage}`;
  if (history.summary.realizedPnlStatus === "incomplete") return `Покрытие реализованной прибыли: ${coverage}. Часть закрытий без надежной реализованной прибыли`;
  return "Реализованная прибыль пока недоступна в источнике. Настоящий ноль не подставляется.";
}

function formatLifetimeSummary(history: ClosedBotsHistory | null) {
  if (!history) return "н/д";
  if (history.summary.avgLifetimeDays === null) {
    if (history.summary.lifetimeStatus === "unavailable") return "Источник не отдал";
    if (history.summary.lifetimeStatus === "incomplete") return "Покрытие неполное";
  }
  return history.summary.avgLifetimeDays === null ? "н/д" : `${formatNumber(history.summary.avgLifetimeDays, 2)} д`;
}

function describeClosedAveragePnlPerDay(history: ClosedBotsHistory | null) {
  if (!history) return null;
  if (history.summary.avgPnlPerDay === null) {
    return "Средняя прибыль/день считается только там, где уже восстановлена длительность закрытого запуска.";
  }
  return `Средняя прибыль/день по закрытым запускам с известной длительностью`;
}

function describeCoverageField(field: string, history: ClosedBotsHistory | null) {
  if (!history) return null;
  const fieldMap: Record<string, { ratio: number | null; status: string }> = {
    realized: { ratio: history.summary.realizedPnlCoverageRatio, status: history.summary.realizedPnlStatus },
    lifetime: { ratio: history.summary.lifetimeCoverageRatio, status: history.summary.lifetimeStatus },
    closeReason: { ratio: history.summary.closeReasonCoverageRatio, status: history.summary.closeReasonStatus },
    strategyTag: { ratio: history.summary.strategyTagCoverageRatio, status: history.summary.strategyTagStatus },
  };
  const info = fieldMap[field];
  if (!info) return null;
  const coverage = `${((info.ratio ?? 0) * 100).toFixed(0)}%`;
  return `Покрытие: ${coverage}`;
}
