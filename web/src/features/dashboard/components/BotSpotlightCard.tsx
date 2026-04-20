import { Link } from "react-router-dom";

import { formatApr, formatMoney, formatNumber, statusHintDescription, statusHintLabel, statusLabel, valueToneClass } from "../../../lib/format";
import type { BotListItem } from "../../../lib/types";
import { cn, ui } from "../../../lib/ui";

type BotSpotlightCardProps = {
  title: string;
  bot: BotListItem | null;
  metric: "totalPnl" | "gridApr" | "activityCount";
};

export function BotSpotlightCard({ title, bot, metric }: BotSpotlightCardProps) {
  if (!bot) {
    return (
      <article className={cn(ui.panel(), "p-6")}>
        <span className={cn("text-sm uppercase tracking-[0.18em]", ui.subtitle())}>{title}</span>
        <strong className="mt-5 block text-2xl">Нет данных</strong>
      </article>
    );
  }

  return (
    <Link className={cn(ui.panel({ interactive: true }), "group p-6")} to={`/bots/${encodeURIComponent(bot.id)}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn("text-sm uppercase tracking-[0.18em]", ui.subtitle())}>{title}</span>
        <span className={`hint-pill hint-${bot.statusHint}`} title={statusHintDescription(bot.statusHint)} aria-label={statusHintDescription(bot.statusHint)}>
          {statusHintLabel(bot.statusHint)}
        </span>
      </div>
      <strong className={cn(ui.heading({ size: "hero" }), "mt-5 flex items-center gap-2 text-[2rem]")}>
        <span>{bot.symbol || bot.id}</span>
        {bot.leverage !== null && <span className={ui.leverageBadge()}>x{bot.leverage}</span>}
      </strong>
      <p className={cn("mt-2 text-sm", ui.subtitle())}>
        {statusLabel(bot.status)} · {bot.botType || "неизвестно"}
      </p>
      <div className={cn("mt-6 text-3xl leading-none tracking-[-0.03em]", metricToneClass(bot, metric))}>
        {formatMetric(bot, metric)}
      </div>
      <div className={cn("mt-6 grid gap-3 text-sm", ui.subtitle())}>
        <span>Капитал {formatMoney(bot.equity)}</span>
        <span className={valueToneClass(bot.totalPnl)}>Прибыль/убыток {formatMoney(bot.totalPnl)}</span>
        <span>Bybit APR сетки {formatApr(bot.gridApr)}</span>
        <span>Сделок сетки {formatNumber(bot.activityCount, 0)}</span>
      </div>
    </Link>
  );
}

function formatMetric(bot: BotListItem, metric: BotSpotlightCardProps["metric"]) {
  if (metric === "gridApr") return formatApr(bot.gridApr);
  if (metric === "activityCount") return formatNumber(bot.activityCount, 0);
  return formatMoney(bot.totalPnl);
}

function metricToneClass(bot: BotListItem, metric: BotSpotlightCardProps["metric"]) {
  if (metric === "totalPnl") return valueToneClass(bot.totalPnl);
  if (metric === "gridApr") return valueToneClass(bot.gridApr);
  return "";
}
