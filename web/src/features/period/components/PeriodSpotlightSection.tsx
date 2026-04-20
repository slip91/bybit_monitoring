import { formatMoney, valueToneClass } from "@lib/format";
import type { PeriodSummary } from "@lib/types";
import { cn, ui } from "@lib/ui";

type Props = { summary: PeriodSummary | null };

export function PeriodSpotlightSection({ summary }: Props) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Фокус</p>
          <h2 className={ui.heading()}>Лучший и худший бот периода</h2>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SpotlightCard title="Лучший бот" bot={summary?.summary.bestBot} fallbackKind="active" />
        <SpotlightCard title="Худший бот" bot={summary?.summary.worstBot} fallbackKind="closed" />
      </div>
    </section>
  );
}

type SpotlightBot = NonNullable<PeriodSummary["summary"]["bestBot"]>;

function SpotlightCard({ title, bot, fallbackKind }: { title: string; bot: SpotlightBot | null | undefined; fallbackKind: "active" | "closed" }) {
  const kindLabel = (bot?.sourceKind ?? fallbackKind) === "active" ? "Активный" : "Закрытый";
  const tone = bot?.profitabilityStatus === "profit" ? "success" as const : bot?.profitabilityStatus === "loss" ? "error" as const : "default" as const;

  return (
    <article className={ui.card({ subtle: true })}>
      <div className="flex items-start justify-between gap-3">
        <strong>{title}</strong>
        <span className={ui.pill({ tone })}>{kindLabel}</span>
      </div>
      {bot ? (
        <>
          <div className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
            {bot.symbol || bot.botId}
            {bot.leverage !== null && <span className={cn(ui.leverageBadge(), "ml-2")}>x{bot.leverage}</span>}
          </div>
          <div className={cn("mt-4 grid gap-2 text-sm", ui.subtitle())}>
            <span>Bot ID {bot.botId}</span>
            <span className={valueToneClass(bot.combinedPnl)}>Итоговый {formatMoney(bot.combinedPnl)}</span>
            <span>Realized {formatMoney(bot.realizedPnl)}</span>
          </div>
        </>
      ) : (
        <div className={cn(ui.emptyState(), "mt-4")}>Для этого состава и периода бот пока не определяется.</div>
      )}
    </article>
  );
}
