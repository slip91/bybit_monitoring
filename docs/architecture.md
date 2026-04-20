# Архитектурные заметки

## Витрины данных

| Витрина | Источник | Назначение |
|---|---|---|
| **План** | Активные боты в плане (`excludeFromPlan = false`) | Текущий доход vs цель |
| **Статистика периода** | Активные / закрытые / объединённые за выбранное окно | Аналитика за период |
| **Закрытые боты** | `closed_bot_runs` + `completed_fgrid_stats_history` | История стратегий |

Закрытые боты **не участвуют** в расчёте текущего плана.

---

## Флаги исключений

Хранятся в `stats_exclusions`, исходные данные не удаляются. Обновление частичное — остальные флаги не сбрасываются.

| Флаг | Где влияет |
|---|---|
| `excludeFromPlan` | Страница плана |
| `excludeFromPeriodStats` | Статистика периода |
| `excludeFromClosedStats` | Сводка закрытых ботов |

Причины: `experiment` · `technical` · `duplicate` · `invalid_data` · `manual_ignore` · `migration` · `other`

---

## Статистика периода — логика включения

**Активные боты** — попадают если есть хотя бы один снапшот в окне.
`periodPnl = last(total_pnl) - first(total_pnl)` внутри окна. Меньше двух точек → `null`.

**Закрытые боты** — попадают по `coalesce(closed_at, last_observed_at)`.
`realizedPnl` только если source его отдал. `combinedPnl = coalesce(total_pnl, realized_pnl)` — если proxy, помечается.

**Покрытие / надёжность:**
- `window.coverageRatio` — доля окна с локальной историей
- `averagePnlPerDay`: `available` / `incomplete` / `unavailable` в зависимости от покрытия
- `confidenceLevel` агрегирует покрытие, proxy usage, наличие записей

---

## План дохода — формулы

```
estimatedDailyIncome  = Σ (capitalBase × gridApr / 365)
deficitToTarget       = max(0, цель - оценка)
requiredCapital       = цель / (оценка / текущийКапитал)
missingCapital        = max(0, требуемый - текущий)
```

`capitalBase = analytics_investment ?? equity`

`actualIncomePerDay` считается из снапшотов только при ≥25% покрытия 1-дневного окна, иначе fallback на оценку.

---

## Закрытые боты — foundation table

`closed_bot_runs` — один ряд на закрытый run, синхронизируется из `completed_fgrid_stats_history`.

Nullable поля под будущее: `close_reason`, `strategy_tag`, `started_at`, `lifetime_days`.

`profitableClosedBots` / `losingClosedBots` считаются по `finalPnl = total_pnl ?? realized_pnl` — потому что `total_pnl` в legacy history заполнен надёжнее чем `realized_pnl`.
