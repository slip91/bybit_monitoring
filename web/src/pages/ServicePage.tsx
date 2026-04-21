import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AlertsPanel } from "@features/dashboard/components";
import { StatCard } from "@features/dashboard/components";
import { getAlerts, getHealth, getServiceStatus } from "@lib/api";
import { formatDateTime, formatDuration, formatNumber, toErrorMessage } from "@lib/format";
import type { AlertItem, HealthStatus, ServiceStatus } from "@lib/types";
import { cn, ui } from "@lib/ui";

export function ServicePage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [healthResponse, statusResponse, alertsResponse] = await Promise.all([
          getHealth(),
          getServiceStatus(),
          getAlerts(6),
        ]);

        if (cancelled) {
          return;
        }

        setHealth(healthResponse.data);
        setServiceStatus(statusResponse.data);
        setAlerts(alertsResponse.data);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка статуса сервиса…</section>;
  }

  if (error && !health && !serviceStatus) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  const serviceTone = getServiceTone(serviceStatus);

  return (
    <div className={ui.page()}>
      <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
        <p className={ui.eyebrow()}>Операционный статус</p>
        <h2 className={ui.heading({ size: "hero" })}>Сервис обновления и база данных</h2>
        <p className={ui.heroCopy()}>
          Здесь можно смотреть, жив ли backend, когда в последний раз проходил polling и не начали ли данные устаревать. Для повседневного контроля этого достаточно без терминала.
        </p>
      </section>

      <div className={ui.statsGrid()}>
        <StatCard
          label="Backend uptime"
          value={formatDuration(health?.uptimeSec ?? null)}
          tone="cool"
          footnote={`Проверено ${formatDateTime(health?.time ?? null)}`}
        />
        <StatCard
          label="Последний успешный polling"
          value={formatDateTime(serviceStatus?.lastSuccessAt ?? null)}
          footnote={serviceStatus?.isStale ? "Данные начали устаревать" : "Данные пока свежие"}
        />
        <StatCard
          label="Активных ботов в цикле"
          value={formatNumber(serviceStatus?.lastActiveBots ?? null, 0)}
          footnote={`Снапшотов записано ${formatNumber(serviceStatus?.lastSnapshotsInserted ?? null, 0)}`}
        />
        <StatCard
          label="Открытых алертов"
          value={formatNumber(health?.database.openAlerts ?? null, 0)}
          footnote={<Link to="/settings/alerts">Открыть управление алертами</Link>}
          tone="warm"
        />
      </div>

      <section className={ui.settingsGrid()}>
        <article className={cn(ui.panel(), "p-6")}>
          <div className={ui.sectionHeader()}>
            <div>
              <p className={ui.eyebrow()}>Polling</p>
              <h2 className={ui.heading()}>Состояние обновления</h2>
            </div>
            <span className={ui.pill({ tone: serviceToneToPill(serviceTone) })}>
              {serviceStatusLabel(serviceStatus)}
            </span>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Последний старт</span>
              <strong>{formatDateTime(serviceStatus?.lastStartedAt ?? null)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Последнее завершение</span>
              <strong>{formatDateTime(serviceStatus?.lastFinishedAt ?? null)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Последний снапшот</span>
              <strong>{formatDateTime(serviceStatus?.lastSnapshotTime ?? null)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Stale через</span>
              <strong>{formatDuration(serviceStatus?.staleSec ?? null)}</strong>
            </div>
          </div>
          {serviceStatus?.lastErrorMessage ? (
            <div className={cn(ui.note({ tone: "error" }), "mt-4")}>{serviceStatus.lastErrorMessage}</div>
          ) : (
            <div className={cn(ui.note({ tone: "success" }), "mt-4")}>Последний цикл прошел без ошибки.</div>
          )}
        </article>

        <article className={cn(ui.panel(), "p-6")}>
          <div className={ui.sectionHeader()}>
            <div>
              <p className={ui.eyebrow()}>База</p>
              <h2 className={ui.heading()}>SQLite хранилище</h2>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Путь</span>
              <strong className="max-w-[60%] break-all text-right">{health?.database.path || "н/д"}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Всего ботов</span>
              <strong>{formatNumber(health?.database.totalBots ?? null, 0)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border-faint)] pb-3">
              <span>Всего снапшотов</span>
              <strong>{formatNumber(health?.database.totalSnapshots ?? null, 0)}</strong>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Последний снапшот в БД</span>
              <strong>{formatDateTime(health?.database.latestSnapshotTime ?? null)}</strong>
            </div>
          </div>
        </article>
      </section>

      <AlertsPanel alerts={alerts} eyebrow="Наблюдение" title="Последние алерты сервиса" />

      {error && <div className={ui.note({ tone: "error" })}>{error}</div>}
    </div>
  );
}

const TONE_TO_PILL = {
  ok: "success", running: "running", stale: "stale", error: "error",
} as const;

function serviceToneToPill(tone: ReturnType<typeof getServiceTone>) {
  return (TONE_TO_PILL[tone as keyof typeof TONE_TO_PILL] ?? "default") as
    "success" | "running" | "stale" | "error" | "default";
}

function serviceStatusLabel(serviceStatus: ServiceStatus | null) {
  if (!serviceStatus) {
    return "Статус недоступен";
  }
  if (serviceStatus.status === "running") {
    return "Идет обновление";
  }
  if (serviceStatus.isStale) {
    return "Данные устарели";
  }
  if (serviceStatus.status === "ok") {
    return "Все в порядке";
  }
  return "Есть ошибка";
}

function getServiceTone(serviceStatus: ServiceStatus | null) {
  if (!serviceStatus) {
    return "unknown";
  }
  if (serviceStatus.status === "running") {
    return "running";
  }
  if (serviceStatus.isStale) {
    return "stale";
  }
  if (serviceStatus.status === "ok") {
    return "ok";
  }
  return "error";
}
