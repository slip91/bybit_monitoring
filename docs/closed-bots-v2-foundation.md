# Closed Bots V2 Foundation

## Назначение

- Этот слой предназначен только для истории закрытых ботов и будущей strategy analytics.
- Он не участвует в расчете текущего income plan.
- Current plan продолжает отвечать только за active bots in plan.

## Источники данных

- legacy history: `completed_fgrid_stats_history`
- operational warehouse: `bots`, `bot_snapshots`
- новая foundation table: `closed_bot_runs`

## Что делает foundation table

- хранит по одному ряду на закрытый bot run
- синхронизируется из `completed_fgrid_stats_history`
- оставляет nullable-поля под:
  - `close_reason`
  - `close_reason_detail`
  - `strategy_tag`
  - `started_at`
  - `lifetime_days`

## Derived metrics

- `closedBotsCount`
- `totalRealizedPnl`
- `profitableClosedBots`
- `losingClosedBots`
- `avgPnlPerClosedBot`
- `avgLifetimeDays`

## Важная трактовка

- `profitableClosedBots` и `losingClosedBots` считаются по `finalPnl = total_pnl ?? realized_pnl`
- это сделано потому, что в legacy completed history `total_pnl` сейчас заполнен заметно лучше, чем `realized_pnl`
- `totalRealizedPnl` при этом остается отдельным полем и может быть `null` или неполным, если source не дает reliable realized values

## Что дальше можно достроить без ломки слоя

- ручное или автоматическое заполнение `closeReason`
- привязка `strategyTag` через ордера/исполнения
- нормальное разделение realized vs unrealized по run
- strategy summary по символам, тегам и причинам закрытия
