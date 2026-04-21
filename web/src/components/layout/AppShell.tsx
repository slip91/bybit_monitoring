import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import { getServiceStatus } from "@lib/api";
import { formatDateTime } from "@lib/format";
import type { ServiceStatus } from "@lib/types";
import { cn, ui } from "@lib/ui";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);

  const title = getPageTitle(location.pathname);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await getServiceStatus();
        if (!cancelled) setServiceStatus(response.data);
      } catch {
        if (!cancelled) setServiceStatus(null);
      }
    }

    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const statusAppearance = getHeaderStatusAppearance(serviceStatus);

  return (
    <div className="relative min-h-screen px-4 py-6 md:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-brand-glow),transparent_22%),radial-gradient(circle_at_80%_14%,var(--color-warm-glow),transparent_26%)]" />
      <header className="relative z-10 mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid justify-items-start gap-3">
          <p className={ui.eyebrow()}>Bybit Bots</p>
          <h1 className={cn(ui.heading({ size: "hero" }), "text-[clamp(1.9rem,3vw,3.6rem)]")}>
            {title}
          </h1>
          <nav className="flex flex-wrap gap-3">
            <NavLink to="/" end className={({ isActive }) => navClassName(isActive)}>Дашборд</NavLink>
            <NavLink to="/plan" className={({ isActive }) => navClassName(isActive)}>План</NavLink>
            <NavLink to="/summary/period" className={({ isActive }) => navClassName(isActive)}>Период</NavLink>
            <NavLink to="/service" className={({ isActive }) => navClassName(isActive)}>Сервис</NavLink>
            <NavLink to="/history/closed-bots" className={({ isActive }) => navClassName(isActive)}>Закрытые</NavLink>
            <NavLink to="/settings/alerts" className={({ isActive }) => navClassName(isActive)}>Алерты</NavLink>
          </nav>
        </div>
        <div className={cn("inline-flex items-center gap-3 self-start rounded-full border px-4 py-2 text-sm", statusAppearance.toneClass)}>
          <span className="h-2.5 w-2.5 rounded-full bg-current opacity-90 shadow-[0_0_0_4px_var(--color-overlay-mid)]" />
          <span>{statusAppearance.label}</span>
          <span className="text-[0.82rem] text-[var(--color-text-muted)]">{statusAppearance.timeLabel}</span>
        </div>
      </header>
      <main className="relative z-10 grid gap-6">{children}</main>
    </div>
  );
}

function navClassName(isActive: boolean) {
  return cn(
    ui.pill(),
    "px-4 py-2 text-sm text-[var(--color-text-primary)] transition duration-150",
    isActive
      ? "border-[rgba(84,208,200,0.42)] bg-[var(--color-brand-surface-md)] text-[var(--color-brand-text)] shadow-[inset_0_0_0_1px_rgba(84,208,200,0.14),0_10px_28px_rgba(84,208,200,0.14)]"
      : "hover:border-[var(--color-blue-mid)] hover:bg-[var(--color-overlay-soft)]"
  );
}

function getHeaderStatusAppearance(serviceStatus: ServiceStatus | null) {
  const lastRelevantAt =
    serviceStatus?.lastSuccessAt || serviceStatus?.lastFinishedAt || serviceStatus?.lastSnapshotTime || null;

  if (!serviceStatus) {
    return {
      toneClass: "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]",
      label: "Статус недоступен",
      timeLabel: "нет связи",
    };
  }

  if (serviceStatus.status === "running") {
    return {
      toneClass: "border-[var(--color-running-border)] bg-[var(--color-running-surface)] text-[var(--color-running-text)]",
      label: "Идет обновление",
      timeLabel: lastRelevantAt ? `последнее ${formatDateTime(lastRelevantAt)}` : "первый запуск",
    };
  }

  if (serviceStatus.isStale) {
    return {
      toneClass: "border-[var(--color-stale-border)] bg-[var(--color-stale-surface)] text-[var(--color-stale-text)]",
      label: "Данные устарели",
      timeLabel: lastRelevantAt ? `обновлялось ${formatDateTime(lastRelevantAt)}` : "нет обновлений",
    };
  }

  if (serviceStatus.status === "ok") {
    return {
      toneClass: "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]",
      label: "Данные свежие",
      timeLabel: lastRelevantAt ? `обновлено ${formatDateTime(lastRelevantAt)}` : "обновлено только что",
    };
  }

  return {
    toneClass: "border-[var(--color-error-border)] bg-[var(--color-error-surface)] text-[var(--color-error-text)]",
    label: "Ошибка обновления",
    timeLabel: lastRelevantAt ? `последнее ${formatDateTime(lastRelevantAt)}` : "нет успешных данных",
  };
}

const PAGE_TITLES: Array<[string, string]> = [
  ["/", "Пульт ботов"],
  ["/plan", "План дохода"],
  ["/summary", "Статистика периода"],
  ["/history", "Закрытые боты"],
  ["/service", "Сервис"],
  ["/settings", "Настройки алертов"],
];

function getPageTitle(pathname: string): string {
  const match = PAGE_TITLES.find(([prefix]) =>
    prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)
  );
  return match?.[1] ?? "История бота";
}
