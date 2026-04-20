import { cn, ui } from "@lib/ui";
import { formatDateTime, formatMoney, formatNumber, formatExclusionState, valueToneClass, EXCLUSION_REASON_OPTIONS } from "@lib/format";
import type { ClosedBotsHistory, ExclusionReason } from "@lib/types";

type Props = {
  history: ClosedBotsHistory | null;
  busyRunPk: number | null;
  exclusionDrafts: Record<number, ExclusionReason>;
  error: string | null;
  onToggleExclusion: (item: ClosedBotsHistory["items"][number]) => void;
  onExclusionReasonChange: (runPk: number, reason: ExclusionReason) => void;
};

export function ClosedBotsTable({
  history, busyRunPk, exclusionDrafts, error, onToggleExclusion, onExclusionReasonChange,
}: Props) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Запуски</p>
          <h2 className={ui.heading()}>Закрытые запуски ботов</h2>
        </div>
        <span className={ui.sectionCount()}>
          {history?.summary.closedBotsCount ?? 0} в расчете · {history?.summary.excludedRunsCount ?? 0} исключено
        </span>
      </div>
      <div className={ui.tableWrap()}>
        <table className={ui.dataTable()}>
          <thead>
            <tr className={ui.tableHeadRow()}>
              <th className={ui.tableHeadCell()}>Бот</th>
              <th className={ui.tableHeadCell()}>Закрыт</th>
              <th className={ui.tableHeadCell()}>Итоговая прибыль</th>
              <th className={ui.tableHeadCell()}>Средняя прибыль/день</th>
              <th className={ui.tableHeadCell()}>Реализованная прибыль</th>
              <th className={ui.tableHeadCell()}>Длительность</th>
              <th className={ui.tableHeadCell()}>Причина закрытия</th>
              <th className={ui.tableHeadCell()}>Стратегия</th>
              <th className={ui.tableHeadCell()}>Учет</th>
              <th className={ui.tableHeadCell()} />
            </tr>
          </thead>
          <tbody>
            {(history?.items || []).map((item) => (
              <tr key={item.closedRunPk} className={ui.tableBodyRow({ excluded: item.excludeFromClosedStats })}>
                <td className={ui.tableCell()}>
                  <strong>
                    {item.symbol || item.legacyBotId}
                    {item.leverage !== null && <span className={cn(ui.leverageBadge(), "ml-2")}>x{item.leverage}</span>}
                  </strong>
                  <div className={ui.subtitle()}>{item.legacyBotId}</div>
                </td>
                <td className={ui.tableCell()}>{formatDateTime(item.closedAt || item.lastObservedAt)}</td>
                <td className={cn(ui.tableCell(), valueToneClass(item.finalPnl))}>{formatMoney(item.finalPnl)}</td>
                <td className={cn(ui.tableCell(), valueToneClass(item.averagePnlPerDay))}>{formatClosedAveragePnlPerDayCell(item)}</td>
                <td className={ui.tableCell()}>{formatRealizedCell(item.realizedPnl, item.realizedPnlStatus)}</td>
                <td className={ui.tableCell()}>{formatLifetimeCell(item.lifetimeDays, item.lifetimeStatus)}</td>
                <td className={ui.tableCell()}>{formatCloseReasonCell(item.closeReason, item.closeReasonStatus)}</td>
                <td className={ui.tableCell()}>{formatStrategyTagCell(item.strategyTag, item.strategyTagStatus)}</td>
                <td className={ui.tableCell()}>{formatExclusionState(item.excludeFromClosedStats, item.excludeReason)}</td>
                <td className={ui.tableCell()}>
                  <div className={ui.actionStack()}>
                    <select
                      className={ui.formControl()}
                      value={exclusionDrafts[item.closedRunPk] || item.excludeReason || "other"}
                      onChange={(e) => onExclusionReasonChange(item.closedRunPk, e.target.value as ExclusionReason)}
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
                      disabled={busyRunPk === item.closedRunPk}
                      onClick={() => onToggleExclusion(item)}
                    >
                      {busyRunPk === item.closedRunPk ? "..." : item.excludeFromClosedStats ? "Вернуть" : "Исключить"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <div className={cn(ui.note({ tone: "error" }), "mt-4")}>{error}</div>}
    </section>
  );
}

// Helper functions
function formatRealizedCell(value: number | null, status: "available" | "unavailable") {
  if (status === "available") return formatMoney(value);
  return "Источник не отдал";
}

function formatLifetimeCell(value: number | null, status: "available" | "unavailable") {
  if (status === "available" && value !== null) return `${formatNumber(value, 2)} д`;
  return "Длительность еще не восстановлена";
}

function formatClosedAveragePnlPerDayCell(item: ClosedBotsHistory["items"][number]) {
  if (item.averagePnlPerDay !== null) return formatMoney(item.averagePnlPerDay);
  if (item.lifetimeStatus === "unavailable") return "Нет длительности";
  return "Недоступно";
}

function formatCloseReasonCell(value: string | null, status: "available" | "unavailable") {
  if (status === "available" && value) return value;
  return "Причина закрытия не пришла из source";
}

function formatStrategyTagCell(value: string | null, status: "available" | "unavailable") {
  if (status === "available" && value) return value;
  return "Тег стратегии еще не привязан";
}
