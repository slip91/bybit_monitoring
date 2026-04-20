import { useEffect, useMemo, useState } from "react";

import { StatCard } from "../features/dashboard/components";
import { getPeriodSummary, updateBotStatsExclusion, updateClosedRunStatsExclusion } from "../lib/api";
import { formatDateTime, formatMoney, formatNumber, formatPercent, exclusionReasonLabel, exclusionReasonDraft, formatExclusionState, EXCLUSION_REASON_OPTIONS, toErrorMessage, valueToneClass, confidenceLabel, coverageStatusLabel } from "../lib/format";
import type { PeriodSummary } from "../lib/types";
import { cn, ui } from "../lib/ui";

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


export function PeriodSummaryPage() {
  const [windowKey, setWindowKey] = useState<(typeof WINDOW_OPTIONS)[number]["key"]>("7d");
  const [composition, setComposition] = useState<(typeof COMPOSITION_OPTIONS)[number]["key"]>("combined");
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShowingExcluded, setIsShowingExcluded] = useState(false);
  const [busyItemKey, setBusyItemKey] = useState<string | null>(null);
  const [exclusionDrafts, setExclusionDrafts] = useState<Record<string, ExclusionReason>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const response = await getPeriodSummary(windowKey, composition);
        if (!cancelled) {
          setSummary(response.data);
          setError(null);
        }
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
  }, [windowKey, composition]);

  const visibleItems = useMemo(() => {
    if (!summary) {
      return [];
    }

    return isShowingExcluded ? summary.items : summary.items.filter((item) => !item.excludeFromPeriodStats);
  }, [isShowingExcluded, summary]);

  async function reload() {
    const response = await getPeriodSummary(windowKey, composition);
    setSummary(response.data);
  }

  async function togglePeriodExclusion(item: PeriodSummary["items"][number]) {
    try {
      setBusyItemKey(item.key);
      const nextExcluded = !item.excludeFromPeriodStats;
      const excludeReason = nextExcluded ? exclusionReasonDraft(item.excludeReason, exclusionDrafts, item.key) : null;

      if (item.sourceKind === "active") {
        await updateBotStatsExclusion(item.botId, {
          excludeFromPeriodStats: nextExcluded,
          excludeReason,
        });
      } else {
        await updateClosedRunStatsExclusion(periodClosedRunPk(item), {
          excludeFromPeriodStats: nextExcluded,
          excludeReason,
        });
      }

      await reload();
      setError(null);
    } catch (actionError) {
      setError(toErrorMessage(actionError));
    } finally {
      setBusyItemKey(null);
    }
  }

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка сводки…</section>;
  }

  if (error && !summary) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  return (
    <div className={ui.page()}>
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
              className={cn(
                "rounded-[20px] border px-4 py-3 text-left transition",
                windowKey === option.key
                  ? "plan-basis-chip-active border-[var(--color-brand-border)] bg-[var(--color-brand-surface)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
              )}
              onClick={() => setWindowKey(option.key)}
            >
              <strong>{option.label}</strong>
              <span>{summary?.window.key === option.key ? periodCoverageLabel(summary.window.coverageStatus) : "Выбрать окно"}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          {COMPOSITION_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={cn(
                "rounded-[20px] border px-4 py-3 text-left transition",
                composition === option.key
                  ? "plan-basis-chip-active border-[var(--color-brand-border)] bg-[var(--color-brand-surface)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
              )}
              onClick={() => setComposition(option.key)}
            >
              <strong>{option.label}</strong>
              <span>{compositionNote(option.key)}</span>
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

        {summary?.summary.notes.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {summary.summary.notes.map((note) => (
              <span key={note} className={ui.pill()}>
                {periodNoteLabel(note)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Период coverage"
            value={formatPercent((summary?.window.coverageRatio ?? 0) * 100, 0)}
            footnote={describeWindowCoverage(summary)}
          />
          <StatCard
            label="Realized coverage"
            value={coverageStatusLabel(summary?.summary.realizedPnlStatus)}
            footnote={describeRealizedCoverage(summary)}
          />
          <StatCard
            label="Lifetime coverage"
            value={coverageStatusLabel(summary?.summary.lifetimeStatus)}
            footnote={describeLifetimeCoverage(summary)}
          />
          <StatCard
            label="Proxy usage"
            value={summary?.summary.usesFinalPnlProxy ? "Есть" : "Нет"}
            footnote={
              summary?.summary.usesFinalPnlProxy
                ? "Часть closed metrics опирается на final PnL как proxy"
                : "Proxy не понадобился"
            }
          />
          <StatCard
            label="Исключения"
            value={`${summary?.summary.excludedBotsCount ?? 0} / ${summary?.summary.excludedRunsCount ?? 0}`}
            footnote="Исключено: active bots / closed runs"
          />
          <StatCard
            label="Состав"
            value={summary?.composition.label || "н/д"}
            footnote={`${summary?.summary.botsInvolvedCount ?? 0} в расчете · ${visibleItems.length} показано`}
          />
          <StatCard
            label="Средняя прибыль/день по всем"
            value={formatAveragePnlPerDay(summary)}
            valueClassName={valueToneClass(summary?.summary.averagePnlPerDay ?? null)}
            footnote={formatAveragePnlPerDayStatus(summary)}
          />
        </div>
      </section>

      <section className={cn(ui.panel(), "p-6")}>
        <div className={ui.sectionHeader()}>
          <div>
            <p className={ui.eyebrow()}>Фокус</p>
            <h2 className={ui.heading()}>Лучший и худший бот периода</h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className={ui.card({ subtle: true })}>
            <div className="flex items-start justify-between gap-3">
              <strong>Лучший бот</strong>
              <span className={ui.pill({ tone: spotlightTone(summary?.summary.bestBot?.profitabilityStatus) })}>
                {sourceKindLabel(summary?.summary.bestBot?.sourceKind || "active")}
              </span>
            </div>
            {summary?.summary.bestBot ? (
              <>
                <div className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
                  {summary.summary.bestBot.symbol || summary.summary.bestBot.botId}
                  {summary.summary.bestBot.leverage !== null ? (
                    <span className={cn(ui.leverageBadge(), "ml-2")}>x{summary.summary.bestBot.leverage}</span>
                  ) : null}
                </div>
                <div className={cn("mt-4 grid gap-2 text-sm", ui.subtitle())}>
                  <span>Bot ID {summary.summary.bestBot.botId}</span>
                  <span className={valueToneClass(summary.summary.bestBot.combinedPnl)}>
                    Итоговый {formatMoney(summary.summary.bestBot.combinedPnl)}
                  </span>
                  <span>Realized {formatMoney(summary.summary.bestBot.realizedPnl)}</span>
                </div>
              </>
            ) : (
              <div className={cn(ui.emptyState(), "mt-4")}>Для этого состава и периода лучший бот пока не определяется.</div>
            )}
          </article>

          <article className={ui.card({ subtle: true })}>
            <div className="flex items-start justify-between gap-3">
              <strong>Худший бот</strong>
              <span className={ui.pill({ tone: spotlightTone(summary?.summary.worstBot?.profitabilityStatus) })}>
                {sourceKindLabel(summary?.summary.worstBot?.sourceKind || "closed")}
              </span>
            </div>
            {summary?.summary.worstBot ? (
              <>
                <div className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
                  {summary.summary.worstBot.symbol || summary.summary.worstBot.botId}
                  {summary.summary.worstBot.leverage !== null ? (
                    <span className={cn(ui.leverageBadge(), "ml-2")}>x{summary.summary.worstBot.leverage}</span>
                  ) : null}
                </div>
                <div className={cn("mt-4 grid gap-2 text-sm", ui.subtitle())}>
                  <span>Bot ID {summary.summary.worstBot.botId}</span>
                  <span className={valueToneClass(summary.summary.worstBot.combinedPnl)}>
                    Итоговый {formatMoney(summary.summary.worstBot.combinedPnl)}
                  </span>
                  <span>Realized {formatMoney(summary.summary.worstBot.realizedPnl)}</span>
                </div>
              </>
            ) : (
              <div className={cn(ui.emptyState(), "mt-4")}>Для этого состава и периода худший бот пока не определяется.</div>
            )}
          </article>
        </div>
      </section>

      <section className={cn(ui.panel(), "p-6")}>
        <div className={ui.sectionHeader()}>
          <div>
            <p className={ui.eyebrow()}>Боты периода</p>
            <h2 className={ui.heading()}>Кто вошел в сводку периода</h2>
          </div>
          <div className={ui.sectionActions()}>
            <label className={ui.checkbox()}>
              <input type="checkbox" checked={isShowingExcluded} onChange={(event) => setIsShowingExcluded(event.target.checked)} />
              <span>Показывать исключенные</span>
            </label>
            <span className={ui.sectionCount()}>
              {summary?.summary.botsInvolvedCount ?? 0} в расчете · {summary?.summary.excludedBotsCount ?? 0} active исключено ·{" "}
              {summary?.summary.excludedRunsCount ?? 0} closed исключено
            </span>
          </div>
        </div>
        {visibleItems.length ? (
          <div className={ui.tableWrap()}>
            <table className={ui.dataTable()}>
              <thead>
                <tr className={ui.tableHeadRow()}>
                  <th className={ui.tableHeadCell()}>Бот</th>
                  <th className={ui.tableHeadCell()}>Статус</th>
                  <th className={ui.tableHeadCell()}>Net PnL</th>
                  <th className={ui.tableHeadCell()}>Средняя прибыль/день</th>
                  <th className={ui.tableHeadCell()}>Realized</th>
                  <th className={ui.tableHeadCell()}>Итоговый / proxy</th>
                  <th className={ui.tableHeadCell()}>Наблюдение</th>
                  <th className={ui.tableHeadCell()}>Качество</th>
                  <th className={ui.tableHeadCell()}>Учет</th>
                  <th className={ui.tableHeadCell()} />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.key} className={ui.tableBodyRow({ excluded: item.excludeFromPeriodStats })}>
                  <td className={ui.tableCell()}>
                    <strong>
                      {item.symbol || item.botId}
                      {item.leverage !== null && <span className={cn(ui.leverageBadge(), "ml-2")}>x{item.leverage}</span>}
                    </strong>
                    <div className={ui.subtitle()}>{item.botId}</div>
                  </td>
                    <td className={ui.tableCell()}>
                      {sourceKindLabel(item.sourceKind)}
                      <div className={ui.subtitle()}>{currentStatusLabel(item.currentStatus)}</div>
                    </td>
                    <td className={cn(ui.tableCell(), valueToneClass(item.periodPnl))}>{formatMoney(item.periodPnl)}</td>
                    <td className={cn(ui.tableCell(), valueToneClass(item.averagePnlPerDay))}>{formatAveragePnlPerDayCell(item)}</td>
                    <td className={ui.tableCell()}>{formatRealizedCell(item.realizedPnl, item.realizedPnlStatus)}</td>
                    <td className={cn(ui.tableCell(), valueToneClass(item.combinedPnl))}>
                      {formatCombinedCell(item)}
                    </td>
                    <td className={ui.tableCell()}>{formatObservedWindow(item)}</td>
                    <td className={ui.tableCell()}>{dataQualityLabel(item.dataQualityStatus)}</td>
                    <td className={ui.tableCell()}>{formatExclusionState(item.excludeFromPeriodStats, item.excludeReason)}</td>
                    <td className={ui.tableCell()}>
                      <div className={ui.actionStack()}>
                        <select
                          className={ui.formControl()}
                          value={exclusionReasonDraft(item.excludeReason, exclusionDrafts, item.key)}
                          onChange={(event) =>
                            setExclusionDrafts((current) => ({
                              ...current,
                              [item.key]: event.target.value as ExclusionReason,
                            }))
                          }
                        >
                          {EXCLUSION_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className={ui.button()}
                          type="button"
                          disabled={busyItemKey === item.key}
                          onClick={() => void togglePeriodExclusion(item)}
                        >
                          {busyItemKey === item.key ? "..." : item.excludeFromPeriodStats ? "Вернуть" : "Исключить"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={ui.emptyState()}>Для этого окна и состава нет строк с учетом текущих exclusion flags.</div>
        )}
        {error && <div className={cn(ui.note({ tone: "error" }), "mt-4")}>{error}</div>}
      </section>
    </div>
  );
}

function confidenceTone(value: "low" | "medium" | "high") {
  if (value === "high")   return "success" as const;
  if (value === "medium") return "stale" as const;
  return "error" as const;
}

function spotlightTone(value: "profit" | "loss" | "flat" | "unknown" | undefined) {
  if (value === "profit") return "success" as const;
  if (value === "loss")   return "error" as const;
  return "default" as const;
}

function periodCoverageLabel(value: PeriodSummary["window"]["coverageStatus"]) {
  return { available: "Покрытие полное", incomplete: "Покрытие частичное", unavailable: "Покрытие недоступно" }[value] ?? "Покрытие недоступно";
}



function describeWindowCoverage(summary: PeriodSummary | null) {
  if (!summary) {
    return null;
  }

  if (summary.window.key === "all") {
    return "Все время = только локально накопленная история";
  }

  return `Наблюдаемое окно ${formatNumber(summary.window.observedDays, 2)} д из ${summary.window.requestedDays ?? 0} д`;
}

function describeRealizedCoverage(summary: PeriodSummary | null) {
  if (!summary) {
    return null;
  }

  if (summary.summary.realizedPnlStatus === "available") {
    return `Покрытие realized ${formatPercent((summary.summary.realizedPnlCoverageRatio ?? 0) * 100, 0)}`;
  }
  if (summary.summary.realizedPnlStatus === "incomplete") {
    return `Покрытие realized ${formatPercent((summary.summary.realizedPnlCoverageRatio ?? 0) * 100, 0)}. У части ботов нет надежного realized breakdown`;
  }
  return "Realized breakdown недоступен. Настоящий ноль не подставляется.";
}

function describeLifetimeCoverage(summary: PeriodSummary | null) {
  if (!summary) {
    return null;
  }

  if (summary.composition.key === "active") {
    return "Для active-only состава lifetime не применяется";
  }
  if (summary.summary.lifetimeStatus === "available") {
    return `Покрытие lifetime ${formatPercent((summary.summary.lifetimeCoverageRatio ?? 0) * 100, 0)}`;
  }
  if (summary.summary.lifetimeStatus === "incomplete") {
    return `Покрытие lifetime ${formatPercent((summary.summary.lifetimeCoverageRatio ?? 0) * 100, 0)}. Есть только у части closed bots`;
  }
  return "Lifetime breakdown по closed bots пока недоступен.";
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

function compositionNote(value: (typeof COMPOSITION_OPTIONS)[number]["key"]) {
  return { active: "Только текущие active snapshots", closed: "Только закрытая история", combined: "Объединенный периодный вид" }[value];
}

function sourceKindLabel(value: "active" | "closed") {
  return value === "active" ? "Активный" : "Закрытый";
}

function currentStatusLabel(value: "active" | "closed") {
  return value === "active" ? "Сейчас active" : "Сейчас closed";
}



function formatAveragePnlPerDay(summary: PeriodSummary | null) {
  if (!summary) {
    return "н/д";
  }
  if (summary.summary.averagePnlPerDayStatus === "unavailable") {
    return "Недоступно";
  }
  return formatMoney(summary.summary.averagePnlPerDay);
}

function formatAveragePnlPerDayStatus(summary: PeriodSummary | null) {
  if (!summary) {
    return "Оценка не загружена";
  }
  if (summary.summary.averagePnlPerDayStatus === "available") {
    return "Средний PnL/день можно читать как рабочую метрику";
  }
  if (summary.summary.averagePnlPerDayStatus === "incomplete") {
    return "Средний PnL/день предварительный";
  }
  return "Средний PnL/день пока скрыт из-за слабого coverage";
}

function formatRealizedSummary(summary: PeriodSummary | null) {
  if (!summary) {
    return "н/д";
  }
  if (summary.summary.realizedPnlStatus === "unavailable") {
    return "Недоступно";
  }
  if (summary.summary.realizedPnlStatus === "incomplete" && summary.summary.realizedPnl === null) {
    return "Неполно";
  }
  return formatMoney(summary.summary.realizedPnl);
}

function formatRealizedCell(value: number | null, status: "available" | "incomplete" | "unavailable") {
  if (status === "available" || (status === "incomplete" && value !== null)) {
    return formatMoney(value);
  }
  if (status === "incomplete") {
    return "Неполно";
  }
  return "Недоступно";
}

function formatCombinedCell(item: PeriodSummary["items"][number]) {
  const value = formatMoney(item.combinedPnl);
  if (item.sourceKind === "closed" && item.realizedPnl === null && item.combinedPnl !== null) {
    return `${value} (proxy)`;
  }
  return value;
}

function formatAveragePnlPerDayCell(item: PeriodSummary["items"][number]) {
  if (item.averagePnlPerDay !== null) {
    return formatMoney(item.averagePnlPerDay);
  }

  if (item.sourceKind === "active") {
    return "Недостаточно snapshots";
  }

  return "Недоступно";
}

function formatObservedWindow(item: PeriodSummary["items"][number]) {
  if (item.sourceKind === "active") {
    if (item.observedDays === null) {
      return "Недостаточно snapshots";
    }
    return `${formatNumber(item.observedDays, 2)} д`;
  }

  if (item.lifetimeDays !== null) {
    return `${formatNumber(item.lifetimeDays, 2)} д`;
  }
  return item.closedAt ? `Закрыт ${formatDateTime(item.closedAt)}` : "Lifetime недоступен";
}

function dataQualityLabel(value: "available" | "incomplete" | "unavailable") {
  return { available: "Нормально", incomplete: "Неполно", unavailable: "Слабо" }[value] ?? "Слабо";
}



function periodClosedRunPk(item: PeriodSummary["items"][number]) {
  const raw = item.key.replace("closed:", "");
  return Number(raw);
}
