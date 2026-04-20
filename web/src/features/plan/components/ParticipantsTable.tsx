import type { PlanParticipant } from '../../../lib/types';
import { ParticipantRow } from './ParticipantRow';
import { cn, ui } from '../../../lib/ui';

type ParticipantsTableProps = {
  title: string;
  participants: PlanParticipant[];
  onToggle: (botId: string) => void;
  onOpenBot: (botId: string) => void;
  busyBotId: string | null;
};

export function ParticipantsTable({ title, participants, onToggle, onOpenBot, busyBotId }: ParticipantsTableProps) {
  if (participants.length === 0) {
    return null;
  }

  return (
    <section className={cn(ui.panel(), 'p-6')}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h3 className={ui.heading()}>{title}</h3>
        </div>
        <span className={cn(ui.pill(), 'px-3 py-1 text-sm')}>{participants.length}</span>
      </div>

      <div className={ui.tableWrap()}>
        <table className={ui.dataTable()}>
          <thead>
            <tr className={ui.tableHeadRow()}>
              <th className={ui.tableHeadCell()}>✓</th>
              <th className={ui.tableHeadCell()}>Бот</th>
              <th className={ui.tableHeadCell()}>Статус</th>
              <th className={ui.tableHeadCell()}>Капитал</th>
              <th className={ui.tableHeadCell()}>Total PnL</th>
              <th className={ui.tableHeadCell()}>На 100$/день</th>
              <th className={ui.tableHeadCell()}>Вклад</th>
              <th className={ui.tableHeadCell()}>Доля</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.botId}
                participant={participant}
                onToggle={onToggle}
                onOpenBot={onOpenBot}
                isBusy={busyBotId === participant.botId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
