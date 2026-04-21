import { useNavigate } from "react-router-dom";

import { SECONDS_PER_DAY } from "@lib/time";

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
  valueToneClass,
} from "@lib/format";
import type { BotListItem } from "@lib/types";
import { cn, ui } from "@lib/ui";

type BotTableProps = {
  bots: BotListItem[];
};

export function BotTable({ bots }: BotTableProps) {
  const navigate = useNavigate();

  function openBot(botId: string) {
    navigate(`/bots/${encodeURIComponent(botId)}`);
  }

  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className={ui.eyebrow()}>Сетки</p>
          <h2 className={ui.heading()}>Активные боты</h2>
        </div>
        <span className={cn(ui.pill(), "px-3 py-1 text-sm")}>{bots.length}</span>
      </div>
      <div className={ui.tableWrap()}>
        <table className={ui.dataTable()}>
          <thead>
            <tr className={ui.tableHeadRow()}>
              <th className={ui.tableHeadCell()}>Бот</th>
              <th className={ui.tableHeadCell()}>Статус</th>
              <th className={ui.tableHeadCell()}>Капитал</th>
              <th className={ui.tableHeadCell()}>Прибыль/убыток</th>
              <th className={ui.tableHeadCell()}>Годовая оценка</th>
              <th className={ui.tableHeadCell()}>Время работы</th>
              <th className={ui.tableHeadCell()}>По runtime/день</th>
              <th className={ui.tableHeadCell()}>На 100 $/день</th>
              <th className={ui.tableHeadCell()}>Факт сегодня</th>
              <th className={ui.tableHeadCell()}>Активность</th>
              <th className={ui.tableHeadCell()}>Подсказка</th>
            </tr>
          </thead>
          <tbody>
            {bots.map((bot) => (
              <tr
                key={bot.id}
                className={cn(ui.tableBodyRow(), "cursor-pointer transition hover:bg-[var(--color-surface-row-hover)]")}
                onClick={() => openBot(bot.id)}
              >
                <td className={ui.tableCell()}>
                  <div className="flex min-w-[180px] flex-col gap-1">
                    <strong className="flex items-center gap-2 text-base">
                      <span>{bot.symbol || bot.id}</span>
                      {bot.leverage !== null && <span className={ui.leverageBadge()}>x{bot.leverage}</span>}
                    </strong>
                    <span className="text-[var(--color-text-muted)]">{bot.botType || "неизвестно"}</span>
                  </div>
                </td>
                <td className={cn(ui.tableCell(), "text-[var(--color-text-muted)]")}>{statusLabel(bot.status)}</td>
                <td className={ui.tableCell()}>{formatMoney(bot.equity)}</td>
                <td className={ui.tableCell()}>
                  <div className="grid gap-1">
                    <strong className={valueToneClass(bot.totalPnl)}>{formatMoney(bot.totalPnl)}</strong>
                    <span className={cn("text-xs", valueToneClass(bot.pnlToEquityRatio))}>
                      {formatPercent(bot.pnlToEquityRatio === null ? null : bot.pnlToEquityRatio * 100)}
                    </span>
                  </div>
                </td>
                <td className={ui.tableCell()}>
                  <div className="grid gap-1">
                    <strong>{formatAnnualizedYield(bot.derivedAnnualizedTotalYieldRatio, bot.derivedAnnualizedStatus)}</strong>
                    <span className="text-xs text-[var(--color-text-muted)]" title={annualizedStatusLabel(bot.derivedAnnualizedStatus)}>
                      Bybit APR {formatApr(bot.totalApr)} · Сетка {formatApr(bot.gridApr)}
                    </span>
                  </div>
                </td>
                <td className={ui.tableCell()}>
                  <div className="inline-flex items-center gap-2">
                    <span>{formatDuration(bot.workRuntimeSec ?? bot.runtimeSec)}</span>
                    {bot.runtimeSec !== null ? (
                      <span
                        className={ui.infoIcon()}
                        title={`Наблюдаем локально ${formatDuration(bot.runtimeSec)} · старт ${formatDateTime(bot.runtimeStartedAt)}`}
                        aria-label="Локальное время наблюдения"
                      >
                        i
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={ui.tableCell()}>
                  <div className="grid gap-1">
                    <strong>{formatMoney(runtimeIncomePerDay(bot))}</strong>
                    <span className="text-xs text-[var(--color-text-muted)]">Сейчас {formatMoney(bot.gridProfit)}</span>
                  </div>
                </td>
                <td className={ui.tableCell()}>
                  <div className="grid gap-1">
                    <strong>{formatMoney(runtimeIncomePer100Usd(bot))}</strong>
                    <span className="text-xs text-[var(--color-text-muted)]">Нормализация на 100 $</span>
                  </div>
                </td>
                <td className={ui.tableCell()}>
                  <div className="grid gap-1">
                    <strong className={valueToneClass(bot.factPnlPerDay)}>{formatMoney(bot.factPnlPerDay)}</strong>
                    <span
                      className={cn("text-xs", factVsRuntimeToneClass(factVsRuntimeRatio(bot.factPnlPerDay, runtimeIncomePerDay(bot))))}
                      title="Процент от По runtime/день"
                      aria-label="Процент от По runtime/день"
                    >
                      {formatPercent(factVsRuntimeRatio(bot.factPnlPerDay, runtimeIncomePerDay(bot)), 0)}
                    </span>
                  </div>
                </td>
                <td className={ui.tableCell()}>{formatNumber(bot.activityCount, 0)}</td>
                <td className={ui.tableCell()}>
                  <span
                    className={`hint-pill hint-${bot.statusHint}`}
                    title={statusHintDescription(bot.statusHint)}
                    aria-label={statusHintDescription(bot.statusHint)}
                  >
                    {statusHintLabel(bot.statusHint)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function runtimeIncomePerDay(bot: BotListItem) {
  const runtimeSec = bot.workRuntimeSec ?? bot.runtimeSec;
  if (bot.gridProfit === null || runtimeSec === null || runtimeSec <= 0) return null;
  return bot.gridProfit / (runtimeSec / SECONDS_PER_DAY);
}

function runtimeIncomePer100Usd(bot: BotListItem) {
  const runtimePerDay = runtimeIncomePerDay(bot);
  if (runtimePerDay === null || bot.equity === null || bot.equity <= 0) return null;
  return (runtimePerDay / bot.equity) * 100;
}
