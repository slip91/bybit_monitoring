import { useState } from "react";
import { useAsyncEffect } from "@lib/useAsyncEffect";
import { getClosedBotsHistory, updateClosedRunStatsExclusion } from "@lib/api";
import { toErrorMessage, exclusionReasonDraft } from "@lib/format";
import type { ClosedBotsHistory, ExclusionReason } from "@lib/types";
import { cn, ui } from "@lib/ui";
import { ClosedBotsHeader, ClosedBotsTable } from "@features/bots/components";

/**
 * Страница истории закрытых ботов
 * Показывает статистику и позволяет управлять исключениями из расчета
 */
export function ClosedBotsPage() {
  const [history, setHistory] = useState<ClosedBotsHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRunPk, setBusyRunPk] = useState<number | null>(null);
  const [exclusionDrafts, setExclusionDrafts] = useState<Record<number, ExclusionReason>>({});

  // Загрузка данных при монтировании
  useAsyncEffect(async (signal) => {
    try {
      setIsLoading(true);
      const response = await getClosedBotsHistory();
      if (signal.aborted) return;
      setHistory(response.data);
      setError(null);
    } catch (loadError) {
      if (!signal.aborted) setError(toErrorMessage(loadError));
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, []);

  async function reload() {
    const response = await getClosedBotsHistory();
    setHistory(response.data);
  }

  async function toggleClosedRunExclusion(item: ClosedBotsHistory["items"][number]) {
    try {
      setBusyRunPk(item.closedRunPk);
      const nextExcluded = !item.excludeFromClosedStats;
      const draftReason = exclusionReasonDraft(item.excludeReason, exclusionDrafts as Record<string, string>, String(item.closedRunPk));
      await updateClosedRunStatsExclusion(item.closedRunPk, {
        excludeFromClosedStats: nextExcluded,
        excludeReason: nextExcluded ? (draftReason as ExclusionReason) : null,
      });
      await reload();
      setError(null);
    } catch (actionError) {
      setError(toErrorMessage(actionError));
    } finally {
      setBusyRunPk(null);
    }
  }

  function handleExclusionReasonChange(runPk: number, reason: ExclusionReason) {
    setExclusionDrafts((current) => ({
      ...current,
      [runPk]: reason,
    }));
  }

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка истории закрытых ботов…</section>;
  }

  if (error && !history) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  return (
    <div className={ui.page()}>
      <ClosedBotsHeader history={history} />
      <ClosedBotsTable
        history={history}
        busyRunPk={busyRunPk}
        exclusionDrafts={exclusionDrafts}
        error={error}
        onToggleExclusion={toggleClosedRunExclusion}
        onExclusionReasonChange={handleExclusionReasonChange}
      />
    </div>
  );
}
