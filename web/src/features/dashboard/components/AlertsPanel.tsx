import { formatDateTime, formatNumber } from "../../../lib/format";
import { cn, ui } from "../../../lib/ui";
import type { AlertItem } from "../../../lib/types";

type AlertsPanelProps = {
  alerts: AlertItem[];
  title?: string;
  eyebrow?: string;
  actionMode?: "none" | "manage";
  busyAlertPk?: number | null;
  onAcknowledge?: (alert: AlertItem) => void;
  onSuppress?: (alert: AlertItem) => void;
};

export function AlertsPanel({
  alerts,
  title = "Последние алерты",
  eyebrow = "Сигналы",
  actionMode = "none",
  busyAlertPk = null,
  onAcknowledge,
  onSuppress,
}: AlertsPanelProps) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className={ui.eyebrow()}>{eyebrow}</p>
          <h2 className={ui.heading()}>{title}</h2>
        </div>
      </div>
      {alerts.length === 0 ? (
        <div className={ui.emptyState()}>В хранилище пока нет алертов.</div>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <article key={alert.alertPk} className={cn("rounded-[22px] border px-5 py-4", severityClassName(alert.severity))}>
              <div className="flex items-start justify-between gap-4">
                <strong>{alert.title}</strong>
                <span className={ui.subtitle()}>{formatDateTime(alert.alertTime)}</span>
              </div>
              <p className={cn("mt-3 text-sm leading-6", ui.subtitle())}>{alert.message || "Сообщение не задано."}</p>
              <div className={cn("mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.12em]", ui.subtitle())}>
                <span>{alert.bot?.symbol || "сетка"}</span>
                <span>{alert.metricName || "событие"}</span>
                <span>{alert.metricValue === null ? "н/д" : formatNumber(alert.metricValue)}</span>
                <span>{statusLabel(alert.status)}</span>
              </div>
              {actionMode === "manage" && alert.status === "open" ? (
                <div className="mt-4 flex gap-3">
                  <button
                    className={cn(ui.button({ tone: "ghost" }), "px-4 py-2")}
                    type="button"
                    disabled={busyAlertPk === alert.alertPk}
                    onClick={() => onAcknowledge?.(alert)}
                  >
                    {busyAlertPk === alert.alertPk ? "..." : "Подтвердить"}
                  </button>
                  <button
                    className={cn(ui.pill({ tone: "error" }), "cursor-pointer px-4 py-2 text-sm normal-case tracking-normal transition disabled:opacity-50")}
                    type="button"
                    disabled={busyAlertPk === alert.alertPk}
                    onClick={() => onSuppress?.(alert)}
                  >
                    {busyAlertPk === alert.alertPk ? "..." : "Подавить"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    open: "открыт",
    acknowledged: "подтвержден",
    resolved: "закрыт",
    suppressed: "подавлен",
  };
  return labels[value] ?? value;
}

function severityClassName(value: string) {
  if (value === "critical") return "border-[var(--color-error-border)] bg-[var(--color-error-surface)]";
  if (value === "warning")  return "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)]";
  return "border-[var(--color-border)] bg-[var(--color-surface-subtle)]";
}
