import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { PlanHeader, PlanStats, ParticipantsTable, PlanForm } from './components';
import { getCurrentPlan, updateCurrentPlan, updateCurrentPlanBot } from '@lib/api';
import { toErrorMessage } from '@lib/format';
import type { Plan } from '@lib/types';
import { cn, ui } from '@lib/ui';

export function PlanPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [title, setTitle] = useState('');
  const [targetDailyPnlUsd, setTargetDailyPnlUsd] = useState('30');
  const [status, setStatus] = useState<'active' | 'paused' | 'archived'>('active');
  const [notes, setNotes] = useState('');
  const [busyBotId, setBusyBotId] = useState<string | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const response = await getCurrentPlan();
        if (cancelled) return;

        const data = response.data;
        setPlan(data);
        setTitle(data.title || '');
        setTargetDailyPnlUsd(String(data.targetDailyPnlUsd || 30));
        setStatus(data.status || 'active');
        setNotes(data.notes || '');
        setError(null);
      } catch (loadError) {
        if (!cancelled) setError(toErrorMessage(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const participants = useMemo(() => {
    return [...(plan?.participants || [])].sort((a, b) => {
      const aContribution = a.contributionUsd ?? 0;
      const bContribution = b.contributionUsd ?? 0;
      return bContribution - aContribution;
    });
  }, [plan]);

  const activeInPlan = participants.filter((p) => p.planCategory === 'active_in_plan' && !p.excludeFromPlan);
  const activeOutsidePlan = participants.filter((p) => p.planCategory === 'active_out_of_plan' && !p.excludeFromPlan);
  const excluded = participants.filter((p) => p.excludeFromPlan);

  async function toggleParticipant(botId: string) {
    const participant = participants.find((p) => p.botId === botId);
    if (!participant || busyBotId) return;

    try {
      setBusyBotId(botId);
      await updateCurrentPlanBot(botId, { 
        isIncluded: participant.isIncluded,
        excludeFromPlan: !participant.excludeFromPlan 
      });
      const response = await getCurrentPlan();
      setPlan(response.data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusyBotId(null);
    }
  }

  function openBot(botId: string) {
    navigate(`/bots/${encodeURIComponent(botId)}`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSavingPlan) return;

    try {
      setIsSavingPlan(true);
      setSaveMessage(null);
      await updateCurrentPlan({
        title: title || null,
        targetDailyPnlUsd: Number(targetDailyPnlUsd) || 30,
        status,
        notes: notes || null,
      });
      const response = await getCurrentPlan();
      setPlan(response.data);
      setSaveMessage('План сохранен');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSavingPlan(false);
    }
  }

  if (isLoading) {
    return <section className={cn(ui.panel(), 'px-8 py-7')}>Загрузка плана...</section>;
  }

  if (error) {
    return <section className={cn(ui.panel(), 'border-[var(--color-error-border)] px-8 py-7')}>{error}</section>;
  }

  if (!plan) {
    return <section className={cn(ui.panel(), 'px-8 py-7')}>План не найден</section>;
  }

  return (
    <div className="grid gap-6">
      <section className={cn(ui.panel({ tone: 'hero' }), 'overflow-hidden px-8 py-8')}>
        <PlanHeader title={title} status={status} participantsCount={participants.length} />
      </section>

      <PlanStats
        requiredCapital={plan.summary.requiredCapital}
        missingCapital={plan.summary.missingCapital}
        dailyIncome={plan.summary.estimatedDailyIncome}
        targetDailyPnl={plan.targetDailyPnlUsd}
      />

      <ParticipantsTable
        title="Активные в плане"
        participants={activeInPlan}
        onToggle={toggleParticipant}
        onOpenBot={openBot}
        busyBotId={busyBotId}
      />

      <ParticipantsTable
        title="Активные вне плана"
        participants={activeOutsidePlan}
        onToggle={toggleParticipant}
        onOpenBot={openBot}
        busyBotId={busyBotId}
      />

      {excluded.length > 0 && (
        <ParticipantsTable
          title="Исключенные"
          participants={excluded}
          onToggle={toggleParticipant}
          onOpenBot={openBot}
          busyBotId={busyBotId}
        />
      )}

      <PlanForm
        title={title}
        targetDailyPnlUsd={targetDailyPnlUsd}
        status={status}
        notes={notes}
        isSaving={isSavingPlan}
        saveMessage={saveMessage}
        onTitleChange={setTitle}
        onTargetChange={setTargetDailyPnlUsd}
        onStatusChange={setStatus}
        onNotesChange={setNotes}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
