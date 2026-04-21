import { StatCard } from "@features/dashboard/components";
import { formatMoney, formatNumber, formatPercent, confidenceLabel, coverageStatusLabel, valueToneClass } from "@lib/format";
import type { PeriodSummary } from "@lib/types";
import { cn, ui } from "@lib/ui";

const WINDOW_OPTIONS = [
  { key: "1d", label: "1 день" },
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "90d", label: "90 дней" },
  { key: "500d", label: "500 дней" },
  { key: "all", label: "Все время" },
] as const;

const COMPOSITION_OPTIONS = [
  { key: "active", label: "Только активные боты" },
  { key: "combined", label: "Активные + закрытые" },
  { key: "closed", label: "Только закрытые боты" },
] as const;

type WindowKey = (typeof WINDOW_OPTIONS)[number]["key"];
type CompositionKey = (typeof COMPOSITION_OPTIONS)[number]["key"];

type Props = {
  summary: PeriodSummary | null;
  windowKey: WindowKey;
  composition: CompositionKey;
  visibleItemsCount: number;
  onWindowChange: (key: WindowKey) => void;
  onCompositionChange: (key: CompositionKey) => void;
};

export function PeriodHeroSection({
  summary, windowKey, composition, visibleItemsCount, onWindowChange, onCompositionChange,
}: Props) {
  return (
    <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
      <p className={ui.eyebrow()}>Период</p>
      <h2 className={ui.heading({ size: "hero" })}>Общая статистика за период</h2>
      <p className={ui.heroCopy()}>
        Это отдельная витрина period summary. В нее можно включать активных, закрытых или объединенный состав, но
        current income plan по-прежнему считается только по active bots in plan.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={chipClass(windowKey === option.key)}
            onClick={() => onWindowChange(option.key)}
          >
            <strong className="block">{option.label}</strong>
            {summary?.window.key === option.key && (
              <span className="block text-xs opacity-70">{periodCoverageLabel(summary.window.coverageStatus)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {COMPOSITION_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={chipClass(composition === option.key)}
            onClick={() => onCompositionChange(option.key)}
          >
            <strong className="block">{option.label}</strong>
            <span className="block text-xs opacity-70">{compositionNote(option.key)}</span>
          </button>
        ))}
      </div>

      <div className={cn(ui.card({ subtle: true }), "mt-6")}>
        <div className="flex items-center justify-between gap-4">
          <strong>Надежность периодной оценки</strong>
          <span className={ui.pill({ tone: confidenceTone(summary?.summary.confidenceLevel || "low") })}>
            {confidenceLabel(summary?.summary.confidenceLevel || "low")}
          </span>
        </div>
        <div className={cn("mt-4 flex flex-wrap gap-3 text-sm", ui.subtitle())}>
          <span>{describeWindowCoverage(summary)}</span>
          <span>{formatAveragePnlPerDayStatus(summary)}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={ui.card({ subtle: true })}>
          <span>Итоговый PnL</span>
          <strong className={valueToneClass(summary?.summary.combinedPnl ?? null)}>
            {formatMoney(summary?.summary.combinedPnl ?? null)}
          </strong>
        </article>
        <article className={ui.card({ subtle: true })}>
          <span>Net PnL</span>
          <strong className={valueToneClass(summary?.summary.netPnl ?? null)}>
            {formatMoney(summary?.summary.netPnl ?? null)}
          </strong>
        </article>
        <article className={ui.card({ subtle: true })}>
          <span>Realized PnL</span>
          <strong className={valueToneClass(summary?.summary.realizedPnl ?? null)}>
            {formatRealizedSummary(summary)}
          </strong>
        </article>
        <article className={ui.card({ subtle: true })}>
          <span>Средний PnL/день</span>
          <strong className={valueToneClass(summary?.summary.averagePnlPerDay ?? null)}>
            {formatAveragePnlPerDay(summary)}
          </strong>
        </article>
      </div>

      {(summary?.summary.notes.length ?? 0) > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {summary!.summary.notes.map((note) => (
            <span key={note} className={ui.pill()}>{periodNoteLabel(note)}</span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Период coverage" value={formatPercent((summary?.window.coverageRatio ?? 0) * 100, 0)} footnote={describeWindowCoverage(summary)} />
        <StatCard label="Realized coverage" value={coverageStatusLabel(summary?.summary.realizedPnlStatus)} footnote={describeRealizedCoverage(summary)} />
        <StatCard label="Lifetime coverage" value={coverageStatusLabel(summary?.summary.lifetimeStatus)} footnote={describeLifetimeCoverage(summary)} />
        <StatCard
          label="Proxy usage"
          value={summary?.summary.usesFinalPnlProxy ? "Есть" : "Нет"}
          footnote={summary?.summary.usesFinalPnlProxy ? "Часть closed metrics опирается на final PnL как proxy" : "Proxy не понадобился"}
        />
        <StatCard
          label="Исключения"
          value={`${summary?.summary.excludedBotsCount ?? 0} / ${summary?.summary.excludedRunsCount ?? 0}`}
          footnote="Исключено: active bots / closed runs"
        />
        <StatCard
          label="Состав"
          value={summary?.composition.label || "н/д"}
          footnote={`${summary?.summary.botsInvolvedCount ?? 0} в расчете · ${visibleItemsCount} показано`}
        />
        <StatCard
          label="Средняя прибыль/день по всем"
          value={formatAveragePnlPerDay(summary)}
          valueClassName={valueToneClass(summary?.summary.averagePnlPerDay ?? null)}
          footnote={formatAveragePnlPerDayStatus(summary)}
        />
      </div>
    </section>
  );
}

function confidenceTone(value: "low" | "medium" | "high") {
  if (value === "high") return "success" as const;
  if (value === "medium") return "stale" as const;
  return "error" as const;
}

function periodCoverageLabel(value: PeriodSummary["window"]["coverageStatus"]) {
  return { available: "Покрытие полное", incomplete: "Покрытие частичное", unavailable: "Покрытие недоступно" }[value] ?? "Покрытие недоступно";
}

function compositionNote(value: CompositionKey) {
  return { active: "Только текущие active snapshots", closed: "Только закрытая история", combined: "Объединенный периодный вид" }[value];
}

function describeWindowCoverage(summary: PeriodSummary | null) {
  if (!summary) return null;
  if (summary.window.key === "all") return "Все время = только локально накопленная история";
  return `Наблюдаемое окно ${formatNumber(summary.window.observedDays, 2)} д из ${summary.window.requestedDays ?? 0} д`;
}

function describeRealizedCoverage(summary: PeriodSummary | null) {
  if (!summary) return null;
  if (summary.summary.realizedPnlStatus === "available") return `Покрытие realized ${formatPercent((summary.summary.realizedPnlCoverageRatio ?? 0) * 100, 0)}`;
  if (summary.summary.realizedPnlStatus === "incomplete") return `Покрытие realized ${formatPercent((summary.summary.realizedPnlCoverageRatio ?? 0) * 100, 0)}. У части ботов нет надежного realized breakdown`;
  return "Realized breakdown недоступен. Настоящий ноль не подставляется.";
}

function describeLifetimeCoverage(summary: PeriodSummary | null) {
  if (!summary) return null;
  if (summary.composition.key === "active") return "Для active-only состава lifetime не применяется";
  if (summary.summary.lifetimeStatus === "available") return `Покрытие lifetime ${formatPercent((summary.summary.lifetimeCoverageRatio ?? 0) * 100, 0)}`;
  if (summary.summary.lifetimeStatus === "incomplete") return `Покрытие lifetime ${formatPercent((summary.summary.lifetimeCoverageRatio ?? 0) * 100, 0)}. Есть только у части closed bots`;
  return "Lifetime breakdown по closed bots пока недоступен.";
}

function formatAveragePnlPerDay(summary: PeriodSummary | null) {
  if (!summary) return "н/д";
  if (summary.summary.averagePnlPerDayStatus === "unavailable") return "Недоступно";
  return formatMoney(summary.summary.averagePnlPerDay);
}

function formatAveragePnlPerDayStatus(summary: PeriodSummary | null) {
  if (!summary) return "Оценка не загружена";
  if (summary.summary.averagePnlPerDayStatus === "available") return "Средний PnL/день можно читать как рабочую метрику";
  if (summary.summary.averagePnlPerDayStatus === "incomplete") return "Средний PnL/день предварительный";
  return "Средний PnL/день пока скрыт из-за слабого coverage";
}

function formatRealizedSummary(summary: PeriodSummary | null) {
  if (!summary) return "н/д";
  if (summary.summary.realizedPnlStatus === "unavailable") return "Недоступно";
  if (summary.summary.realizedPnlStatus === "incomplete" && summary.summary.realizedPnl === null) return "Неполно";
  return formatMoney(summary.summary.realizedPnl);
}

function periodNoteLabel(value: string) {
  const labels: Record<string, string> = {
    all_time_tracked_history: "Все время считается только по локально накопленной истории",
    partial_period: "Период покрыт не полностью",
    realized_incomplete: "Realized breakdown неполный",
    lifetime_incomplete: "Lifetime breakdown по закрытым ботам неполный",
    uses_final_pnl_proxy: "Используется final PnL как proxy",
    average_pnl_day_preliminary: "Средний PnL/день пока предварительный",
    average_pnl_day_unavailable: "Средний PnL/день пока не показывается из-за слабого покрытия",
    excluded_records_impact: "Часть записей исключена из сводки",
  };
  return labels[value] ?? value;
}

function chipClass(active: boolean) {
  return cn(
    "rounded-[20px] border px-4 py-3 text-left transition",
    active
      ? "plan-basis-chip-active border-[var(--color-brand-border)] bg-[var(--color-brand-surface)]"
      : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
  );
}
