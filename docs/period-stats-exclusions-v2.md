# Period Stats And Exclusions

## Витрины по смыслу

- `Plan` считает только `active bots in plan`, которые не помечены `excludeFromPlan`.
- `Period Summary` считает выбранное окно отдельно от плана и использует свой состав: `active`, `combined`, `closed`.
- `Closed Bots` остается history/strategy витриной и не влияет на current income plan.

## Exclusion flags

Исключения хранятся отдельно в `stats_exclusions` и не удаляют исходные данные.

- `excludeFromPlan`: бот не участвует в derived metrics страницы плана.
- `excludeFromPeriodStats`: бот или closed run не участвует в period summary.
- `excludeFromClosedStats`: closed run не участвует в closed-bots summary.
- `excludeReason`: причина исключения.
- `excludeNote`: произвольная заметка.

Допустимые причины:

- `experiment`
- `technical`
- `duplicate`
- `invalid_data`
- `manual_ignore`
- `migration`
- `other`

Важно: exclusion update частичный. Если меняется один flag, остальные не должны молча сбрасываться.

## Inclusion logic for Period Summary

### Active bots

- В active period slice попадают только текущие `bots.is_active = 1`.
- Бот считается вошедшим в окно, если в окне есть хотя бы один snapshot.
- Вклад active bot в период считается только по наблюдаемому отрезку внутри окна:
  `periodPnl = last(total_pnl in window) - first(total_pnl in window)`.
- Если внутри окна меньше двух snapshot points с `total_pnl`, `periodPnl` не считается надежным и остается `null`.
- Такое поведение сознательно не восстанавливает "полный" период через значения до окна, чтобы не притворяться точнее, чем позволяет источник.

### Closed bots

- Closed run попадает в окно по `coalesce(closed_at, last_observed_at)`.
- Для closed runs:
  - `realizedPnl` используется только если source реально его отдал;
  - `final/combined pnl` считается как `coalesce(total_pnl, realized_pnl)`.
- Если `realizedPnl` отсутствует, `final/combined pnl` может оставаться доступным, но это помечается как proxy usage.

### Partial overlap

- Active bots с частичным покрытием окна учитываются только по реально наблюдаемому куску.
- Closed runs учитываются как событие закрытия в выбранном периоде.

## Coverage and confidence

- `window.coverageRatio` показывает, сколько окна реально покрыто локальной историей.
- `averagePnlPerDay`:
  - `available` при хорошем coverage;
  - `incomplete` при частичном, но еще читаемом coverage;
  - `unavailable`, если coverage слишком слабое и экстраполяция была бы самообманом.
- `confidenceLevel` агрегирует:
  - period coverage,
  - доступность `averagePnlPerDay`,
  - proxy usage,
  - наличие включенных записей.

## Ограничения source data

- `all time` означает только локально накопленную историю, а не всю жизнь стратегии.
- Для closed runs `realizedPnl`, `lifetime`, `closeReason`, `strategyTag` могут быть частично недоступны.
- Если source не дает надежный breakdown, UI должен показывать `incomplete`, `preliminary` или `unavailable`, а не ложный ноль.
