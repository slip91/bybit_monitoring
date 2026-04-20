import { cn, ui } from "../../../lib/ui";
import { formatDateTime, formatMoney, statusLabel, valueToneClass } from "../../../lib/format";
import type { BotAlertRule } from "../../../lib/types";

type Props = {
  rules: BotAlertRule[];
  savingRuleBotId: string | null;
  savingTradeBotId: string | null;
  testingTradeBotId: string | null;
  tradeActivityNotificationsEnabled: boolean;
  tradeActivityMutedBotIds: string[];
  onRuleSave: (rule: BotAlertRule, formData: FormData) => void;
  onGridProfitCaptureRuleSave: (rule: BotAlertRule, formData: FormData) => void;
  onToggleTradeBotMute: (rule: BotAlertRule) => void;
  onTriggerTradeTest: (rule: BotAlertRule) => void;
};

const SEVERITY_OPTIONS = [
  { value: "info", label: "Инфо" },
  { value: "warning", label: "Предупреждение" },
  { value: "critical", label: "Критично" },
] as const;

export function AlertRulesTable({
  rules,
  savingRuleBotId,
  savingTradeBotId,
  testingTradeBotId,
  tradeActivityNotificationsEnabled,
  tradeActivityMutedBotIds,
  onRuleSave,
  onGridProfitCaptureRuleSave,
  onToggleTradeBotMute,
  onTriggerTradeTest,
}: Props) {
  return (
    <section className={cn(ui.panel(), "p-6")}>
      <div className={ui.sectionHeader()}>
        <div>
          <p className={ui.eyebrow()}>Правила</p>
          <h2 className={ui.heading()}>Порог total PnL по каждой сетке</h2>
        </div>
      </div>
      <div className="grid gap-4">
        {rules.map((rule) => (
          <form
            key={rule.botId}
            className={ui.card({ subtle: true })}
            onSubmit={(event) => {
              event.preventDefault();
              onRuleSave(rule, new FormData(event.currentTarget));
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <strong>{rule.symbol || rule.botId}</strong>
                <div className={ui.subtitle()}>
                  {statusLabel(rule.status)} · {rule.botType || "неизвестно"}
                </div>
              </div>
              <div className={cn("text-xl font-semibold tracking-[-0.03em]", valueToneClass(rule.totalPnl))}>
                {formatMoney(rule.totalPnl)}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className={ui.checkbox()}>
                <input name={`enabled-${rule.botId}`} type="checkbox" defaultChecked={rule.totalPnlRule.enabled} />
                <span>Включить правило</span>
              </label>

              <label className={ui.field()}>
                <span>Условие</span>
                <select className={ui.formControl()} name={`operator-${rule.botId}`} defaultValue={rule.totalPnlRule.comparisonOperator}>
                  <option value="lte">PnL ≤ порог</option>
                  <option value="gte">PnL ≥ порог</option>
                </select>
              </label>

              <label className={ui.field()}>
                <span>Порог PnL</span>
                <input
                  className={ui.formControl()}
                  name={`threshold-${rule.botId}`}
                  type="number"
                  step="0.01"
                  defaultValue={rule.totalPnlRule.thresholdValue ?? ""}
                  placeholder="-10"
                />
              </label>

              <label className={ui.field()}>
                <span>Важность</span>
                <select className={ui.formControl()} name={`severity-${rule.botId}`} defaultValue={rule.totalPnlRule.severity}>
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={cn(ui.sectionActions(), "mt-4")}>
              <button className={ui.button()} type="submit" disabled={savingRuleBotId === rule.botId}>
                {savingRuleBotId === rule.botId ? "Сохранение..." : "Сохранить правило"}
              </button>
              <button
                className={ui.button({ tone: "ghost" })}
                type="button"
                disabled={savingTradeBotId === rule.botId || !tradeActivityNotificationsEnabled}
                onClick={() => onToggleTradeBotMute(rule)}
                title={
                  tradeActivityNotificationsEnabled
                    ? "Отдельно включает или выключает уведомления о новых сделках для этого бота"
                    : "Сначала включи общий переключатель уведомлений о новых сделках"
                }
              >
                {savingTradeBotId === rule.botId
                  ? "..."
                  : tradeActivityMutedBotIds.includes(rule.botId)
                    ? "Включить сделки"
                    : "Выключить сделки"}
              </button>
              <button
                className={ui.button({ tone: "ghost" })}
                type="button"
                disabled={testingTradeBotId === rule.botId || !tradeActivityNotificationsEnabled}
                onClick={() => onTriggerTradeTest(rule)}
                title="Отправляет тестовое Telegram-сообщение в формате уведомления о новой сделке"
              >
                {testingTradeBotId === rule.botId ? "..." : "Тест сделки"}
              </button>
              <span className={ui.sectionCount()}>
                Последний trigger: {formatDateTime(rule.totalPnlRule.lastTriggeredAt)}
              </span>
            </div>
            <div className={cn(ui.note(), "mt-4")}>
              Уведомления о сделках: {tradeActivityMutedBotIds.includes(rule.botId) ? "выключены для этого бота" : "включены"}
            </div>

            {/* Grid Profit Capture Rule */}
            <div className="mt-5 rounded-[18px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <strong>Можно забрать всю grid прибыль</strong>
                  <div className={ui.subtitle()}>
                    Сигнал срабатывает, когда текущий total pnl уже не меньше текущего grid profit.
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-sm font-medium", valueToneClass(rule.gridProfit))}>
                    Grid {formatMoney(rule.gridProfit)}
                  </div>
                  <div className={cn("text-sm", valueToneClass(rule.totalPnl))}>
                    Total {formatMoney(rule.totalPnl)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className={ui.checkbox()}>
                  <input name={`grid-capture-enabled-${rule.botId}`} type="checkbox" defaultChecked={rule.gridProfitCaptureRule.enabled} />
                  <span>Включить правило</span>
                </label>

                <label className={ui.field()}>
                  <span>Важность</span>
                  <select className={ui.formControl()} name={`grid-capture-severity-${rule.botId}`} defaultValue={rule.gridProfitCaptureRule.severity}>
                    {SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={cn(ui.sectionActions(), "items-end")}>
                  <button
                    className={ui.button()}
                    type="button"
                    disabled={savingRuleBotId === rule.botId}
                    onClick={(event) => {
                      event.preventDefault();
                      const form = event.currentTarget.closest("form");
                      if (form) {
                        onGridProfitCaptureRuleSave(rule, new FormData(form));
                      }
                    }}
                  >
                    {savingRuleBotId === rule.botId ? "Сохранение..." : "Сохранить"}
                  </button>
                  <span className={ui.sectionCount()}>
                    Последний trigger: {formatDateTime(rule.gridProfitCaptureRule.lastTriggeredAt)}
                  </span>
                </div>
              </div>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
