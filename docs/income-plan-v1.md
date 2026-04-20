# Income Plan V1

## Scope

- Current income plan answers the question "do active bots in plan cover today's target?"
- Only `active bots` with `plan_bots.is_included = 1` participate in current-plan metrics.
- `Closed bots` are kept visible as separate history material and are excluded from current-plan totals.

## Derived metrics

- `targetDailyIncome`
  - source: `plans.target_daily_pnl_usd`
- `estimatedDailyIncome`
  - sum of per-bot `estimatedIncomePerDay`
- `actualDailyIncome`
  - 1-day snapshot-based fact from `total_pnl` delta
  - returned only when at least one participating bot has enough snapshots to form a delta
- `deficitToTarget`
  - `max(0, targetDailyIncome - estimatedDailyIncome)`
- `percentOfTarget`
  - `estimatedDailyIncome / targetDailyIncome`
- `currentPlanCapital`
  - sum of `equity` for active included bots
- `requiredCapital`
  - `targetDailyIncome / (estimatedDailyIncome / currentPlanCapital)` when estimate yield is positive
- `missingCapital`
  - `max(0, requiredCapital - currentPlanCapital)`

## Per-bot formulas

- `estimatedIncomePerDay`
  - `(capitalBase * gridApr) / 365`
  - `capitalBase = analytics_investment ?? equity`
- `actualIncomePerDay`
  - `(last_total_pnl - first_total_pnl) / observedDays`
  - calculated from snapshots inside the selected window
- `contributionToTargetRatio`
  - `botIncomePerDay / targetDailyIncome`
  - uses `actualIncomePerDay` only when the bot has at least 25% of the 1-day window observed
  - otherwise falls back to `estimatedIncomePerDay`

## Partial day and confidence

- `observationCoverage`
  - share of the 1-day fact window that is actually observed
- `confidenceLevel`
  - `high`
    - near-full 1-day coverage and strong estimate/actual bot coverage
  - `medium`
    - partial day but enough data to avoid a blind estimate
  - `low`
    - no active participating bots, no actual observation, or too many missing fields
- `confidenceReasons`
  - explicit machine-readable reasons such as:
    - `partial_day`
    - `missing_estimate_data`
    - `missing_actual_data`
    - `no_actual_observation`
    - `no_active_bots_in_plan`

## What is included

- Active plan members only
- Estimate from current `grid_apr` and capital base
- Fact from local `bot_snapshots`
- Historical windows `1d / 7d / 30d / 90d` only as observation-based reference

## What is not included

- Closed bots in current-plan totals
- Manual trading PnL
- Separate strategy analytics for closed bots
- Any weighting logic beyond `is_included`
  - `weight` is preserved in storage, but V1 formulas do not reinterpret it

## Why closed bots stay separate

- Closed bots can help evaluate realized strategy history later.
- They do not answer the operational question "does the current active lineup cover today's target?"
- Mixing them into current-plan totals creates false comfort and fake precision.
