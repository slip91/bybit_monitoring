import type { PlanParticipant } from '../../../lib/types';
import { formatMoney, formatPercent, statusLabel, valueToneClass } from '../../../lib/format';
import { cn, ui } from '../../../lib/ui';

type ParticipantRowProps = {
  participant: PlanParticipant;
  onToggle: (botId: string) => void;
  onOpenBot: (botId: string) => void;
  isBusy: boolean;
};

export function ParticipantRow({ participant, onToggle, onOpenBot, isBusy }: ParticipantRowProps) {
  return (
    <tr
      className={cn(
        ui.tableBodyRow(),
        'cursor-pointer transition hover:bg-[var(--color-surface-row-hover)]',
        participant.excludeFromPlan && 'opacity-50'
      )}
      onClick={() => onOpenBot(participant.botId)}
    >
      <td className={ui.tableCell()}>
        <input
          type="checkbox"
          checked={!participant.excludeFromPlan}
          onChange={(e) => {
            e.stopPropagation();
            onToggle(participant.botId);
          }}
          disabled={isBusy}
          className="cursor-pointer"
        />
      </td>
      <td className={ui.tableCell()}>
        <div className="flex min-w-[180px] flex-col gap-1">
          <strong className="flex items-center gap-2 text-base">
            <span>{participant.symbol || participant.botId}</span>
            {participant.leverage !== null && <span className={ui.leverageBadge()}>x{participant.leverage}</span>}
          </strong>
          <span className="text-[var(--color-text-muted)]">{participant.botType || 'неизвестно'}</span>
        </div>
      </td>
      <td className={cn(ui.tableCell(), 'text-[var(--color-text-muted)]')}>{statusLabel(participant.status)}</td>
      <td className={ui.tableCell()}>{formatMoney(participant.equity)}</td>
      <td className={ui.tableCell()}>
        <strong className={valueToneClass(participant.totalPnl)}>{formatMoney(participant.totalPnl)}</strong>
      </td>
      <td className={ui.tableCell()}>{formatMoney(participant.normalizedIncomePer100Usd ?? null)}</td>
      <td className={ui.tableCell()}>
        <strong className={valueToneClass(participant.contributionUsd ?? null)}>
          {formatMoney(participant.contributionUsd ?? null)}
        </strong>
      </td>
      <td className={ui.tableCell()}>{formatPercent(participant.contributionShare ?? null)}</td>
    </tr>
  );
}
