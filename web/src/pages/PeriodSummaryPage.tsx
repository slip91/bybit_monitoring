import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getPeriodSummary, updateBotStatsExclusion, updateClosedRunStatsExclusion } from "@lib/api";
import { exclusionReasonDraft, toErrorMessage } from "@lib/format";
import type { PeriodSummary, ExclusionReason } from "@lib/types";
import { cn, ui } from "@lib/ui";
import { PeriodHeroSection } from "@features/period/components/PeriodHeroSection";
import { PeriodSpotlightSection } from "@features/period/components/PeriodSpotlightSection";
import { PeriodItemsTable } from "@features/period/components/PeriodItemsTable";

type WindowKey = "1d" | "7d" | "30d" | "90d" | "500d" | "all";
type CompositionKey = "active" | "combined" | "closed";

export function PeriodSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const windowKey = (searchParams.get("window") ?? "7d") as WindowKey;
  const composition = (searchParams.get("composition") ?? "combined") as CompositionKey;

  function setWindowKey(key: WindowKey) {
    setSearchParams((prev) => { prev.set("window", key); return prev; }, { replace: true });
  }
  function setComposition(key: CompositionKey) {
    setSearchParams((prev) => { prev.set("composition", key); return prev; }, { replace: true });
  }

  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShowingExcluded, setIsShowingExcluded] = useState(false);
  const [busyItemKey, setBusyItemKey] = useState<string | null>(null);
  const [exclusionDrafts, setExclusionDrafts] = useState<Record<string, ExclusionReason>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const response = await getPeriodSummary(windowKey, composition);
        if (!cancelled) { setSummary(response.data); setError(null); }
      } catch (e) {
        if (!cancelled) setError(toErrorMessage(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [windowKey, composition]);

  const visibleItems = useMemo(() => {
    if (!summary) return [];
    return isShowingExcluded ? summary.items : summary.items.filter((item) => !item.excludeFromPeriodStats);
  }, [isShowingExcluded, summary]);

  async function reload() {
    const response = await getPeriodSummary(windowKey, composition);
    setSummary(response.data);
  }

  async function togglePeriodExclusion(item: PeriodSummary["items"][number]) {
    try {
      setBusyItemKey(item.key);
      const nextExcluded = !item.excludeFromPeriodStats;
      const excludeReason = nextExcluded ? exclusionReasonDraft(item.excludeReason, exclusionDrafts, item.key) as ExclusionReason : null;
      if (item.sourceKind === "active") {
        await updateBotStatsExclusion(item.botId, { excludeFromPeriodStats: nextExcluded, excludeReason });
      } else {
        await updateClosedRunStatsExclusion(Number(item.key.replace("closed:", "")), { excludeFromPeriodStats: nextExcluded, excludeReason });
      }
      await reload();
      setError(null);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusyItemKey(null);
    }
  }

  if (isLoading && !summary) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка сводки…</section>;
  }

  if (error && !summary) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  return (
    <div className={cn(ui.page(), isLoading && "opacity-60 pointer-events-none transition-opacity")}>
      <PeriodHeroSection
        summary={summary}
        windowKey={windowKey}
        composition={composition}
        visibleItemsCount={visibleItems.length}
        onWindowChange={setWindowKey}
        onCompositionChange={setComposition}
      />
      <PeriodSpotlightSection summary={summary} />
      <PeriodItemsTable
        summary={summary}
        visibleItems={visibleItems}
        isShowingExcluded={isShowingExcluded}
        busyItemKey={busyItemKey}
        exclusionDrafts={exclusionDrafts}
        error={error}
        onShowExcludedChange={setIsShowingExcluded}
        onExclusionDraftChange={(key, reason) => setExclusionDrafts((prev) => ({ ...prev, [key]: reason }))}
        onToggleExclusion={(item) => void togglePeriodExclusion(item)}
      />
    </div>
  );
}
