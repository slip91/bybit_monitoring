import { formatMoney, formatPercent } from '../../../lib/format';
import { cn, ui } from '../../../lib/ui';

type PlanStatsProps = {
  requiredCapital: number | null;
  missingCapital: number | null;
  dailyIncome: number | null;
  targetDailyPnl: number | null;
};

export function PlanStats({ requiredCapital, missingCapital, dailyIncome, targetDailyPnl }: PlanStatsProps) {
  const progress = targetDailyPnl && dailyIncome ? (dailyIncome / targetDailyPnl) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className={cn(ui.panel(), 'p-5')}>
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">Требуемый капитал</p>
        <strong className="block text-2xl font-semibold">{formatMoney(requiredCapital)}</strong>
      </div>

      <div className={cn(ui.panel(), 'p-5')}>
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">Не хватает</p>
        <strong className="block text-2xl font-semibold">{formatMoney(missingCapital)}</strong>
      </div>

      <div className={cn(ui.panel(), 'p-5')}>
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">Оценка дохода/день</p>
        <strong className="block text-2xl font-semibold">{formatMoney(dailyIncome)}</strong>
      </div>

      <div className={cn(ui.panel(), 'p-5')}>
        <p className="mb-2 text-sm text-[var(--color-text-muted)]">Прогресс к цели</p>
        <strong className="block text-2xl font-semibold">{formatPercent(progress / 100, 0)}</strong>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Цель: {formatMoney(targetDailyPnl)}</p>
      </div>
    </div>
  );
}
