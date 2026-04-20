import type { FormEvent } from "react";
import { cn, ui } from "@lib/ui";
import { formatDateTime } from "@lib/format";
import type { TelegramAlertSettings } from "@lib/types";

type Props = {
  settings: TelegramAlertSettings | null;
  enabled: boolean;
  botToken: string;
  chatId: string;
  minSeverity: "info" | "warning" | "critical";
  sendResolved: boolean;
  tradeActivityNotificationsEnabled: boolean;
  isSaving: boolean;
  saveMessage: string | null;
  error: string | null;
  onEnabledChange: (enabled: boolean) => void;
  onBotTokenChange: (token: string) => void;
  onChatIdChange: (chatId: string) => void;
  onMinSeverityChange: (severity: "info" | "warning" | "critical") => void;
  onSendResolvedChange: (sendResolved: boolean) => void;
  onTradeActivityChange: (enabled: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const SEVERITY_OPTIONS = [
  { value: "info", label: "Инфо" },
  { value: "warning", label: "Предупреждение" },
  { value: "critical", label: "Критично" },
] as const;

export function TelegramSettingsForm({
  settings,
  enabled,
  botToken,
  chatId,
  minSeverity,
  sendResolved,
  tradeActivityNotificationsEnabled,
  isSaving,
  saveMessage,
  error,
  onEnabledChange,
  onBotTokenChange,
  onChatIdChange,
  onMinSeverityChange,
  onSendResolvedChange,
  onTradeActivityChange,
  onSubmit,
}: Props) {
  return (
    <article className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Telegram</p>
          <h2 className={ui.heading()}>Канал уведомлений</h2>
        </div>
      </div>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className={ui.checkbox()}>
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
          <span>Включить Telegram-алерты</span>
        </label>

        <label className={ui.field()}>
          <span>Bot Token</span>
          <input
            className={ui.formControl()}
            type="password"
            value={botToken}
            onChange={(e) => onBotTokenChange(e.target.value)}
            placeholder={settings?.hasBotToken ? settings.botTokenMasked || "Скрыт" : "123456:ABC..."}
          />
          <small className={ui.subtitle()}>
            {settings?.hasBotToken ? "Оставь пустым, чтобы сохранить текущий token." : "Пока token не задан."}
          </small>
        </label>

        <label className={ui.field()}>
          <span>Chat ID</span>
          <input className={ui.formControl()} type="text" value={chatId} onChange={(e) => onChatIdChange(e.target.value)} placeholder="-1001234567890" />
        </label>

        <label className={ui.field()}>
          <span>Минимальная важность</span>
          <select className={ui.formControl()} value={minSeverity} onChange={(e) => onMinSeverityChange(e.target.value as "info" | "warning" | "critical")}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={ui.checkbox()}>
          <input type="checkbox" checked={sendResolved} onChange={(e) => onSendResolvedChange(e.target.checked)} />
          <span>Отправлять сообщения о resolved-событиях</span>
        </label>

        <label className={ui.checkbox()}>
          <input type="checkbox" checked={tradeActivityNotificationsEnabled} onChange={(e) => onTradeActivityChange(e.target.checked)} />
          <span>Уведомлять о новых сделках после обновления snapshot</span>
        </label>

        <div className={ui.sectionActions()}>
          <button className={ui.button()} type="submit" disabled={isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить настройки"}
          </button>
          <span className={ui.sectionCount()}>Обновлено: {formatDateTime(settings?.updatedAt || null)}</span>
        </div>
      </form>

      {saveMessage && <div className={cn(ui.note({ tone: "success" }), "mt-4")}>{saveMessage}</div>}
      {error && <div className={cn(ui.note({ tone: "error" }), "mt-4")}>{error}</div>}
    </article>
  );
}
