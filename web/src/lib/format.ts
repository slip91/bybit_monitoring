function isNullish(value: number | null): value is null {
  return value === null;
}

export function formatMoney(value: number | null, digits = 2) {
  if (isNullish(value)) return "н/д";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(value: number | null, digits = 2) {
  if (isNullish(value)) return "н/д";

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null, digits = 2) {
  if (isNullish(value)) {
    return "н/д";
  }

  return `${formatNumber(value, digits)}%`;
}

export function formatApr(value: number | null, digits = 2) {
  if (isNullish(value)) {
    return "н/д";
  }

  return formatPercent(value * 100, digits);
}

export function formatAnnualizedYield(value: number | null, status?: "stable" | "preliminary" | "unstable" | "unavailable", digits = 2) {
  if (isNullish(value)) {
    return "н/д";
  }

  const rendered = formatPercent(value * 100, digits);
  if (status === "preliminary" || status === "unstable") {
    return `~ ${rendered}`;
  }

  return rendered;
}

export function annualizedStatusLabel(value: "stable" | "preliminary" | "unstable" | "unavailable") {
  const labels = {
    stable: "оценка устойчива",
    preliminary: "оценка предварительная",
    unstable: "оценка нестабильна",
    unavailable: "оценка недоступна",
  };
  return labels[value] ?? "оценка недоступна";
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "н/д";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(valueSec: number | null) {
  if (valueSec === null || !Number.isFinite(valueSec)) {
    return "н/д";
  }

  const totalMinutes = Math.max(0, Math.floor(valueSec / 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return minutes > 0 ? `${days} д ${hours} ч ${minutes} мин` : `${days} д ${hours} ч`;
  }
  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours} ч ${minutes} мин` : `${totalHours} ч`;
  }

  return `${Math.max(1, totalMinutes)} мин`;
}

export function statusLabel(status: string | null) {
  if (!status) {
    return "Неизвестно";
  }

  const normalized = status.replace("FUTURE_GRID_STATUS_", "");

  if (normalized === "RUNNING") {
    return "Активен";
  }
  if (normalized === "COMPLETED") {
    return "Завершен";
  }

  return normalized.replace(/_/g, " ").toLowerCase();
}

export function statusHintLabel(value: string) {
  const labels: Record<string, string> = {
    overall_green: "общая картина положительная",
    grid_works_position_hurts: "сетка работает, позиция тянет вниз",
    weak_activity: "слабая активность",
    high_drawdown: "высокая просадка",
  };
  return labels[value] ?? "неизвестно";
}

export function statusHintDescription(value: string) {
  const descriptions: Record<string, string> = {
    overall_green: "Бот сейчас локально выглядит здорово: общая прибыль не отрицательная или отношение PnL к капиталу не уходит в минус.",
    grid_works_position_hurts: "Сетка по APR выглядит рабочей, но текущая позиция и общий PnL тянут результат вниз.",
    weak_activity: "По локальному наблюдению у бота пока мало активности, поэтому оценка по нему слабая.",
    high_drawdown: "Это не дневная просадка. Метка ставится по откату текущего total PnL от лучшего локально увиденного total PnL за все время наблюдения ботом.",
  };
  return descriptions[value] ?? "Локальная подсказка по состоянию бота на основе накопленных snapshot-метрик.";
}

export function valueToneClass(value: number | null) {
  if (isNullish(value) || value === 0) {
    return "";
  }

  return value > 0 ? "value-positive" : "value-negative";
}

export function factVsRuntimeRatio(actualToday: number | null, runtimePerDay: number | null) {
  if (
    actualToday === null ||
    runtimePerDay === null ||
    Number.isNaN(actualToday) ||
    Number.isNaN(runtimePerDay) ||
    runtimePerDay <= 0
  ) {
    return null;
  }

  return (actualToday / runtimePerDay) * 100;
}

export function factVsRuntimeToneClass(value: number | null) {
  if (isNullish(value)) {
    return "fact-runtime-neutral";
  }

  if (value < 50) {
    return "fact-runtime-low";
  }

  if (value < 100) {
    return "fact-runtime-mid";
  }

  return "fact-runtime-high";
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Неизвестная ошибка";
}

export function exclusionReasonLabel(value: string | null): string {
  const labels: Record<string, string> = {
    experiment: "эксперимент",
    technical: "техническое",
    duplicate: "дубликат",
    invalid_data: "неверные данные",
    manual_ignore: "игнор вручную",
    migration: "миграция",
    other: "другое",
  };
  return value ? (labels[value] ?? "не указана") : "не указана";
}

export function coverageStatusLabel(value: "available" | "incomplete" | "unavailable" | undefined) {
  return { available: "Полное", incomplete: "Частичное", unavailable: "Недоступно" }[value ?? "unavailable"] ?? "Недоступно";
}

export function confidenceLabel(value: "low" | "medium" | "high") {
  return { high: "Надежно", medium: "Предварительно", low: "Слабо" }[value] ?? "Слабо";
}

export const EXCLUSION_REASON_OPTIONS = [
  { value: "manual_ignore", label: "Игнор вручную" },
  { value: "experiment",    label: "Эксперимент" },
  { value: "technical",     label: "Техническое" },
  { value: "duplicate",     label: "Дубликат" },
  { value: "invalid_data",  label: "Неверные данные" },
  { value: "migration",     label: "Миграция" },
  { value: "other",         label: "Другое" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export function formatExclusionState(isExcluded: boolean, reason: string | null): string {
  if (!isExcluded) return "Учитывается";
  return reason ? `Исключен · ${exclusionReasonLabel(reason)}` : "Исключен";
}

export function exclusionReasonDraft(
  reason: string | null | undefined, drafts: Record<string, string>, key: string,
): string {
  return drafts[key] || reason || "manual_ignore";
}
