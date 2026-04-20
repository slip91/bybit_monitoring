import { cn, ui } from "../../../lib/ui";
import { formatDateTime } from "../../../lib/format";
import type { ServiceStatus } from "../../../lib/types";

type Props = {
  serviceStatus: ServiceStatus | null;
};

function serviceStatusLabel(status: string): string {
  if (status === "running") return "Работает";
  if (status === "stopped") return "Остановлен";
  return "Неизвестно";
}

function serviceStatusToPill(status: ServiceStatus | null): "success" | "error" | "default" {
  if (!status) return "default";
  if (status.isStale) return "error";
  if (status.status === "running") return "success";
  return "default";
}

export function ServiceStatusCard({ serviceStatus }: Props) {
  return (
    <article className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Сервис</p>
          <h2 className={ui.heading()}>Статус обновления</h2>
        </div>
        <span className={ui.pill({ tone: serviceStatusToPill(serviceStatus) })}>
          {serviceStatus?.isStale ? "Данные устарели" : serviceStatusLabel(serviceStatus?.status || "unknown")}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <span className={ui.subtitle()}>Последний старт</span>
          <strong>{formatDateTime(serviceStatus?.lastStartedAt || null)}</strong>
        </div>
        <div className="grid gap-1">
          <span className={ui.subtitle()}>Последний успех</span>
          <strong>{formatDateTime(serviceStatus?.lastSuccessAt || null)}</strong>
        </div>
        <div className="grid gap-1">
          <span className={ui.subtitle()}>Активных ботов</span>
          <strong>{serviceStatus?.lastActiveBots ?? "н/д"}</strong>
        </div>
        <div className="grid gap-1">
          <span className={ui.subtitle()}>Вставлено снапшотов</span>
          <strong>{serviceStatus?.lastSnapshotsInserted ?? "н/д"}</strong>
        </div>
      </div>
      {serviceStatus?.lastErrorMessage ? (
        <div className={cn(ui.note({ tone: "error" }), "mt-4")}>{serviceStatus.lastErrorMessage}</div>
      ) : null}
      {serviceStatus?.isStale ? (
        <div className={cn(ui.note({ tone: "error" }), "mt-4")}>
          Данные давно не обновлялись. Последний успешный цикл был {formatDateTime(serviceStatus.lastSuccessAt || null)}.
        </div>
      ) : null}
    </article>
  );
}
