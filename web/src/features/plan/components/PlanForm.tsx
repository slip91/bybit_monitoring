import type { FormEvent } from 'react';
import { cn, ui } from '../../../lib/ui';

type PlanFormProps = {
  title: string;
  targetDailyPnlUsd: string;
  status: 'active' | 'paused' | 'archived';
  notes: string;
  isSaving: boolean;
  saveMessage: string | null;
  onTitleChange: (value: string) => void;
  onTargetChange: (value: string) => void;
  onStatusChange: (value: 'active' | 'paused' | 'archived') => void;
  onNotesChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function PlanForm({
  title,
  targetDailyPnlUsd,
  status,
  notes,
  isSaving,
  saveMessage,
  onTitleChange,
  onTargetChange,
  onStatusChange,
  onNotesChange,
  onSubmit,
}: PlanFormProps) {
  return (
    <section className={cn(ui.panel(), 'p-6')}>
      <h3 className={cn(ui.heading(), 'mb-6')}>Настройки плана</h3>

      <form onSubmit={onSubmit} className="grid gap-4">
        <label className={ui.field()}>
          <span>Название</span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className={ui.formControl()}
            placeholder="План дохода"
          />
        </label>

        <label className={ui.field()}>
          <span>Целевой доход ($/день)</span>
          <input
            type="number"
            value={targetDailyPnlUsd}
            onChange={(e) => onTargetChange(e.target.value)}
            className={ui.formControl()}
            step="0.01"
          />
        </label>

        <label className={ui.field()}>
          <span>Статус</span>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as 'active' | 'paused' | 'archived')}
            className={ui.formControl()}
          >
            <option value="active">Активен</option>
            <option value="paused">Приостановлен</option>
            <option value="archived">Архив</option>
          </select>
        </label>

        <label className={ui.field()}>
          <span>Заметки</span>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className={ui.formControl()}
            rows={3}
            placeholder="Дополнительные заметки..."
          />
        </label>

        <div className={ui.sectionActions()}>
          <button type="submit" disabled={isSaving} className={ui.button()}>
            {isSaving ? 'Сохранение...' : 'Сохранить план'}
          </button>
          {saveMessage && <span className={cn(ui.note({ tone: 'success' }))}>{saveMessage}</span>}
        </div>
      </form>
    </section>
  );
}
