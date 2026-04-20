import { formatDateTime, formatMoney, formatNumber, exclusionReasonDraft, formatExclusionState, EXCLUSION_REASON_OPTIONS, valueToneClass } from "@lib/format";
import type { PeriodSummary, ExclusionReason } from "@lib/types";
import { cn, ui } from "@lib/ui";

type Item = PeriodSummary["items"][number];

type Props = {
  summary: PeriodSummary | null;
  visibleItems: Item[];
  isShowingExcluded: boolean;
  busyItemKey: string | null;
  exclusionDrafts: Record<string, ExclusionReason>;
  error: string | null;
  onShowExcludedChange: (value: boolean) => void;
  onExclusionDraftChange: (key: string, reason: ExclusionReason) => void;
  onToggleExclusion: (item: Item) => void;
};

export function PeriodItemsTable({
  summary, visibleItems, isShowingExcluded, busyItemKey, exclusionDrafts, error,
  onShowExcludedChange, onExclusionDraftChange, onToggleExclusion,
}: Props) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Боты периода</p>
          <h2 className={ui.heading()}>Кто вошел в сводку периода</h2>
        </div>
        <div className={ui.sectionActions()}>
          <label className={ui.checkbox()}>
            <input type="checkbox" checked={isShowingExcluded} onChange={(e) => onShowExcludedChange(e.target.checked)} />
            <span>Показывать исключенные</span>
          </label>
          <span className={ui.sectionCount()}>
            {`${summary?.summary.botsInvolvedCount ?? 0} в расчете · ${summary?.summary.excludedBotsCount ?? 0} active исключено · ${summary?.summary.excludedRunsCount ?? 0} closed исключено`}
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
                    {item.sourceKind === "active" ? "Активный" : "Закрытый"}
                    <div className={ui.subtitle()}>{item.currentStatus === "active" ? "Сейчас active" : "Сейчас closed"}</div>
                  </td>
                  <td className={cn(ui.tableCell(), valueToneClass(item.periodPnl))}>{formatMoney(item.periodPnl)}</td>
                  <td className={cn(ui.tableCell(), valueToneClass(item.averagePnlPerDay))}>{formatAvgPnlCell(item)}</td>
                  <td className={ui.tableCell()}>{formatRealizedCell(item.realizedPnl, item.realizedPnlStatus)}</td>
                  <td className={cn(ui.tableCell(), valueToneClass(item.combinedPnl))}>{formatCombinedCell(item)}</td>
                  <td className={ui.tableCell()}>{formatObservedWindow(item)}</td>
                  <td className={ui.tableCell()}>{dataQualityLabel(item.dataQualityStatus)}</td>
                  <td className={ui.tableCell()}>{formatExclusionState(item.excludeFromPeriodStats, item.excludeReason)}</td>
                  <td className={ui.tableCell()}>
                    <div className={ui.actionStack()}>
                      <select
                        className={ui.formControl()}
                        value={exclusionReasonDraft(item.excludeReason, exclusionDrafts, item.key)}
                        onChange={(e) => onExclusionDraftChange(item.key, e.target.value as ExclusionReason)}
                      >
                        {EXCLUSION_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        className={ui.button()}
                        type="button"
                        disabled={busyItemKey === item.key}
                        onClick={() => onToggleExclusion(item)}
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
  );
}

function formatAvgPnlCell(item: Item) {
  if (item.averagePnlPerDay !== null) return formatMoney(item.averagePnlPerDay);
  return item.sourceKind === "active" ? "Недостаточно snapshots" : "Недоступно";
}

function formatRealizedCell(value: number | null, status: "available" | "incomplete" | "unavailable") {
  if (status === "available" || (status === "incomplete" && value !== null)) return formatMoney(value);
  return status === "incomplete" ? "Неполно" : "Недоступно";
}

function formatCombinedCell(item: Item) {
  const value = formatMoney(item.combinedPnl);
  return item.sourceKind === "closed" && item.realizedPnl === null && item.combinedPnl !== null ? `${value} (proxy)` : value;
}

function formatObservedWindow(item: Item) {
  if (item.sourceKind === "active") {
    return item.observedDays === null ? "Недостаточно snapshots" : `${formatNumber(item.observedDays, 2)} д`;
  }
  if (item.lifetimeDays !== null) return `${formatNumber(item.lifetimeDays, 2)} д`;
  return item.closedAt ? `Закрыт ${formatDateTime(item.closedAt)}` : "Lifetime недоступен";
}

function dataQualityLabel(value: "available" | "incomplete" | "unavailable") {
  return { available: "Нормально", incomplete: "Неполно", unavailable: "Слабо" }[value] ?? "Слабо";
}
