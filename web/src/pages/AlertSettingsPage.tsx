import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { AlertsPanel } from "@features/dashboard/components/AlertsPanel";
import {
  acknowledgeAlert,
  getAlerts,
  getBotAlertRules,
  getServiceStatus,
  getTelegramAlertSettings,
  sendTestTradeNotification,
  suppressAlert,
  updateBotGridProfitCaptureRule,
  updateBotTotalPnlRule,
  updateTelegramAlertSettings,
} from "@lib/api";
import { toErrorMessage } from "@lib/format";
import type { AlertItem, BotAlertRule, ServiceStatus, TelegramAlertSettings } from "@lib/types";
import { cn, ui } from "@lib/ui";
import { ServiceStatusCard, TelegramSettingsForm, AlertRulesTable } from "@features/alerts/components";

/**
 * Страница настроек алертов и Telegram уведомлений
 * Управляет правилами для ботов и настройками канала уведомлений
 */
export function AlertSettingsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [settings, setSettings] = useState<TelegramAlertSettings | null>(null);
  const [rules, setRules] = useState<BotAlertRule[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [minSeverity, setMinSeverity] = useState<"info" | "warning" | "critical">("warning");
  const [sendResolved, setSendResolved] = useState(false);
  const [tradeActivityNotificationsEnabled, setTradeActivityNotificationsEnabled] = useState(false);
  const [tradeActivityMutedBotIds, setTradeActivityMutedBotIds] = useState<Array<string>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingRuleBotId, setSavingRuleBotId] = useState<string | null>(null);
  const [savingTradeBotId, setSavingTradeBotId] = useState<string | null>(null);
  const [testingTradeBotId, setTestingTradeBotId] = useState<string | null>(null);
  const [busyAlertPk, setBusyAlertPk] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Загрузка данных при монтировании
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const [alertsResponse, statusResponse, settingsResponse, rulesResponse] = await Promise.all([
          getAlerts(20),
          getServiceStatus(),
          getTelegramAlertSettings(),
          getBotAlertRules(),
        ]);

        if (cancelled) return;

        const nextSettings = settingsResponse.data;
        setAlerts(alertsResponse.data);
        setServiceStatus(statusResponse.data);
        setSettings(nextSettings);
        setRules(rulesResponse.data);
        setEnabled(nextSettings.enabled);
        setChatId(nextSettings.chatId || "");
        setMinSeverity(nextSettings.minSeverity);
        setSendResolved(nextSettings.sendResolved);
        setTradeActivityNotificationsEnabled(nextSettings.tradeActivityNotificationsEnabled);
        setTradeActivityMutedBotIds(nextSettings.tradeActivityMutedBotIds);
        setBotToken("");
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
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSaving(true);
      const response = await updateTelegramAlertSettings({
        enabled,
        botToken,
        chatId,
        minSeverity,
        sendResolved,
        tradeActivityNotificationsEnabled,
        tradeActivityMutedBotIds,
      });

      setSettings(response.data);
      setTradeActivityMutedBotIds(response.data.tradeActivityMutedBotIds);
      setBotToken("");
      setSaveMessage("Настройки Telegram сохранены.");
      setError(null);
    } catch (saveError) {
      setError(toErrorMessage(saveError));
      setSaveMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRuleSave(rule: BotAlertRule, formData: FormData) {
    const enabledValue = formData.get(`enabled-${rule.botId}`) === "on";
    const thresholdRaw = String(formData.get(`threshold-${rule.botId}`) || "").trim();
    const thresholdValue = thresholdRaw === "" ? null : Number(thresholdRaw);
    const comparisonOperator = String(formData.get(`operator-${rule.botId}`) || "lte") === "gte" ? "gte" : "lte";
    const severity = normalizeSeverity(String(formData.get(`severity-${rule.botId}`) || "warning"));

    if (enabledValue && !Number.isFinite(thresholdValue)) {
      setError(`Для правила ${rule.symbol || rule.botId} нужно задать порог PnL, если оно включено.`);
      setSaveMessage(null);
      return;
    }

    try {
      setSavingRuleBotId(rule.botId);
      const response = await updateBotTotalPnlRule(rule.botId, {
        enabled: enabledValue,
        comparisonOperator,
        thresholdValue,
        severity,
      });

      setRules((current) =>
        current.map((item) => (item.botId === rule.botId ? response.data : item))
      );
      setError(null);
      setSaveMessage(`Правило для ${rule.symbol || rule.botId} сохранено.`);
    } catch (saveError) {
      setError(toErrorMessage(saveError));
      setSaveMessage(null);
    } finally {
      setSavingRuleBotId(null);
    }
  }

  async function handleGridProfitCaptureRuleSave(rule: BotAlertRule, formData: FormData) {
    const enabledValue = formData.get(`grid-capture-enabled-${rule.botId}`) === "on";
    const severity = normalizeSeverity(String(formData.get(`grid-capture-severity-${rule.botId}`) || "warning"));

    try {
      setSavingRuleBotId(rule.botId);
      const response = await updateBotGridProfitCaptureRule(rule.botId, {
        enabled: enabledValue,
        severity,
      });

      setRules((current) =>
        current.map((item) => (item.botId === rule.botId ? response.data : item))
      );
      setError(null);
      setSaveMessage(`Правило grid profit для ${rule.symbol || rule.botId} сохранено.`);
    } catch (saveError) {
      setError(toErrorMessage(saveError));
      setSaveMessage(null);
    } finally {
      setSavingRuleBotId(null);
    }
  }

  async function handleAcknowledge(alert: AlertItem) {
    try {
      setBusyAlertPk(alert.alertPk);
      const response = await acknowledgeAlert(alert.alertPk);
      setAlerts((current) => replaceAlertInList(current, response.data));
      setError(null);
    } catch (actionError) {
      setError(toErrorMessage(actionError));
    } finally {
      setBusyAlertPk(null);
    }
  }

  async function handleSuppress(alert: AlertItem) {
    try {
      setBusyAlertPk(alert.alertPk);
      const response = await suppressAlert(alert.alertPk);
      setAlerts((current) => replaceAlertInList(current, response.data));
      if (response.data.bot?.id) {
        const rulesResponse = await getBotAlertRules();
        setRules(rulesResponse.data);
      }
      setError(null);
    } catch (actionError) {
      setError(toErrorMessage(actionError));
    } finally {
      setBusyAlertPk(null);
    }
  }

  async function toggleTradeBotMute(rule: BotAlertRule) {
    const nextMutedBotIds = tradeActivityMutedBotIds.includes(rule.botId)
      ? tradeActivityMutedBotIds.filter((item) => item !== rule.botId)
      : [...tradeActivityMutedBotIds, rule.botId];

    try {
      setSavingTradeBotId(rule.botId);
      const response = await updateTelegramAlertSettings({
        enabled,
        botToken,
        chatId,
        minSeverity,
        sendResolved,
        tradeActivityNotificationsEnabled,
        tradeActivityMutedBotIds: nextMutedBotIds,
      });

      setSettings(response.data);
      setTradeActivityMutedBotIds(response.data.tradeActivityMutedBotIds);
      setBotToken("");
      setError(null);
      setSaveMessage(
        nextMutedBotIds.includes(rule.botId)
          ? `Уведомления о сделках для ${rule.symbol || rule.botId} выключены.`
          : `Уведомления о сделках для ${rule.symbol || rule.botId} включены.`
      );
    } catch (saveError) {
      setError(toErrorMessage(saveError));
      setSaveMessage(null);
    } finally {
      setSavingTradeBotId(null);
    }
  }

  async function triggerTradeTest(rule: BotAlertRule) {
    try {
      setTestingTradeBotId(rule.botId);
      await sendTestTradeNotification(rule.botId);
      setError(null);
      setSaveMessage(`Тестовое уведомление по ${rule.symbol || rule.botId} отправлено.`);
    } catch (actionError) {
      setError(toErrorMessage(actionError));
      setSaveMessage(null);
    } finally {
      setTestingTradeBotId(null);
    }
  }

  if (isLoading) {
    return <section className={cn(ui.panel(), "px-8 py-7")}>Загрузка настроек алертов…</section>;
  }

  if (error && !settings) {
    return <section className={cn(ui.panel(), "border-[var(--color-error-border)] px-8 py-7")}>{error}</section>;
  }

  return (
    <div className={ui.page()}>
      <section className={cn(ui.panel({ tone: "hero" }), "px-8 py-8")}>
        <p className={ui.eyebrow()}>Уведомления</p>
        <h2 className={ui.heading({ size: "hero" })}>Настройки Telegram и состояние локального polling-сервиса.</h2>
        <p className={ui.heroCopy()}>
          Страница не торгует и не отправляет ничего сама по себе. Здесь только локальная конфигурация канала уведомлений и список уже записанных алертов.
        </p>
      </section>

      <section className={ui.settingsGrid()}>
        <ServiceStatusCard serviceStatus={serviceStatus} />

        <TelegramSettingsForm
          settings={settings}
          enabled={enabled}
          botToken={botToken}
          chatId={chatId}
          minSeverity={minSeverity}
          sendResolved={sendResolved}
          tradeActivityNotificationsEnabled={tradeActivityNotificationsEnabled}
          isSaving={isSaving}
          saveMessage={saveMessage}
          error={error}
          onEnabledChange={setEnabled}
          onBotTokenChange={setBotToken}
          onChatIdChange={setChatId}
          onMinSeverityChange={setMinSeverity}
          onSendResolvedChange={setSendResolved}
          onTradeActivityChange={setTradeActivityNotificationsEnabled}
          onSubmit={handleSubmit}
        />
      </section>

      <AlertRulesTable
        rules={rules}
        savingRuleBotId={savingRuleBotId}
        savingTradeBotId={savingTradeBotId}
        testingTradeBotId={testingTradeBotId}
        tradeActivityNotificationsEnabled={tradeActivityNotificationsEnabled}
        tradeActivityMutedBotIds={tradeActivityMutedBotIds}
        onRuleSave={handleRuleSave}
        onGridProfitCaptureRuleSave={handleGridProfitCaptureRuleSave}
        onToggleTradeBotMute={toggleTradeBotMute}
        onTriggerTradeTest={triggerTradeTest}
      />

      <AlertsPanel
        alerts={alerts}
        title="Алерты в базе"
        eyebrow="Сигналы"
        actionMode="manage"
        busyAlertPk={busyAlertPk}
        onAcknowledge={(alert) => void handleAcknowledge(alert)}
        onSuppress={(alert) => void handleSuppress(alert)}
      />
    </div>
  );
}

// Helper functions
function normalizeSeverity(value: string): "info" | "warning" | "critical" {
  if (value === "info" || value === "critical") {
    return value;
  }
  return "warning";
}

function replaceAlertInList(items: AlertItem[], nextAlert: AlertItem) {
  const hasExisting = items.some((item) => item.alertPk === nextAlert.alertPk);
  if (!hasExisting) {
    return [nextAlert, ...items];
  }
  return items.map((item) => (item.alertPk === nextAlert.alertPk ? nextAlert : item));
}
