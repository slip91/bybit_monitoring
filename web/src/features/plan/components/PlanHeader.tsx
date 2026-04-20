import { cn, ui } from '@lib/ui';

type PlanHeaderProps = {
  title: string;
  status: 'active' | 'paused' | 'archived';
  participantsCount: number;
};

export function PlanHeader({ title, status, participantsCount }: PlanHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className={ui.eyebrow()}>План дохода</p>
        <h2 className={cn(ui.heading({ size: 'hero' }), 'text-[clamp(1.5rem,2.2vw,2.5rem)]')}>
          {title || 'План дохода'}
        </h2>
      </div>
      <div className="flex gap-2">
        <span className={cn(ui.pill({ tone: status === 'active' ? 'success' : 'default' }), 'px-4 py-2 text-sm')}>
          {status === 'active' ? 'Активен' : status === 'paused' ? 'Приостановлен' : 'Архив'}
        </span>
        <span className={cn(ui.pill(), 'px-4 py-2 text-sm')}>{participantsCount} ботов</span>
      </div>
    </div>
  );
}
