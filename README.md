# Bybit Bots

## Структура

```text
bybit-bots/
├── README.md
├── backend
├── db
│   ├── bybit-bots.sqlite
│   ├── sql
│   │   └── init_bot_warehouse.sql
│   └── tmp
├── legacy
│   ├── api_server.js
│   ├── lib
│   ├── node_modules
│   └── package.json
├── scripts
│   ├── api_server_legacy.js
│   ├── refresh_bybit_bots.js
│   ├── report_active_bots.js
│   ├── snapshot_active_bots.js
│   └── snapshot_active_bots_service.js
└── web
```

## Что хранится

- `bot_inventory`
  - все найденные боты
  - для активных ботов хранятся только `bot_id`, `symbol`, `bot_type`, `route`, `status`, `source`, `discovered_at`
- `completed_fgrid_stats_history`
  - история снапшотов только для завершенных `futures grid` ботов
  - новый снапшот пишется только если данные изменились

## Как запускать

Обычное обновление по текущему inventory в базе:

```bash
node scripts/refresh_bybit_bots.js --api-only
```

Обновление с JSON-отчетом:

```bash
node scripts/refresh_bybit_bots.js --json --api-only
```

Отчет по активным ботам из локальной базы, включая `total_apr` и `grid_apr`:

```bash
node scripts/report_active_bots.js
```

JSON-отчет по активным ботам:

```bash
node scripts/report_active_bots.js --json
```

Сохранить snapshot активных ботов в таблицы `bots` и `bot_snapshots`:

```bash
node scripts/snapshot_active_bots.js
```

JSON-отчет по snapshot-запуску:

```bash
node scripts/snapshot_active_bots.js --json
```

Legacy локальный сервис, который делает snapshot активных ботов раз в 5 минут:

```bash
node scripts/snapshot_active_bots_service.js
```

Сейчас основной polling перенесен внутрь `Nest` backend и запускается вместе с `backend/`.

Read-only HTTP API поверх SQLite:

```bash
node scripts/api_server_legacy.js
```

По умолчанию API слушает `127.0.0.1:3000`.

## LM Studio helper

Для изолированных AI-подзадач можно использовать тонкий runner без встраивания в backend:

```bash
node scripts/lm_studio_task.js --show-models
```

Быстрый вызов с prompt:

```bash
node scripts/lm_studio_task.js \
  --model qwen/qwen3.5-9b \
  --prompt "Кратко суммаризируй состояние backend по этим логам: ..."
```

Через stdin:

```bash
tail -n 200 db/tmp/launchd-backend.stderr.log | \
node scripts/lm_studio_task.js \
  --system "Ты помощник по локальной диагностике Node/NestJS. Верни краткий список проблем."
```

Поддерживаемые переменные окружения:

- `LM_STUDIO_BASE_URL` — например `http://127.0.0.1:1234/v1`
- `LM_STUDIO_API_KEY` — если твой endpoint требует ключ
- `LLM_MODEL` — дефолтный model id

Если `message.content` пустой, скрипт автоматически проверяет `message.reasoning_content`, что полезно для некоторых reasoning-моделей в LM Studio.

## Новый Backend

Параллельно добавлен новый backend на `NestJS + Prisma` в `backend/`.

Это переходный слой рядом с legacy runtime в `legacy/`, чтобы можно было мигрировать без ломки текущего UI.

Быстрый старт:

```bash
cd backend
cp .env.example .env
npm run prisma:generate
npm run start
```

По умолчанию новый backend слушает `127.0.0.1:3100`.

По умолчанию вместе с `backend/` стартует встроенный polling snapshot-цикла:

- `SNAPSHOT_POLLING_ENABLED=true`
- `SNAPSHOT_POLLING_INTERVAL_MS=300000`

Отключить встроенный polling можно через:

```bash
cd backend
SNAPSHOT_POLLING_ENABLED=false npm run start
```

Сейчас `backend/` уже обслуживает те же endpoint'ы, что нужны текущему UI:

- `GET /health`
- `GET /service/status`
- `GET /bots`
- `GET /bots/:id`
- `GET /bots/:id/snapshots`
- `GET /dashboard/summary`
- `GET /alerts`
- `PUT /alerts/:id/acknowledge`
- `PUT /alerts/:id/suppress`
- `GET /settings/telegram-alerts`
- `PUT /settings/telegram-alerts`
- `GET /settings/alert-rules`
- `PUT /settings/alert-rules/:botId/total-pnl`
- `GET /plans/current`
- `PUT /plans/current`
- `PUT /plans/current/bots/:botId`

Пока это migration-friendly слой: Nest дает новую структуру приложения, а часть бизнес-логики и DTO временно переиспользуется через bridge из текущего `lib/`, чтобы не ломать фронт во время переноса.

Переопределить host/port можно через:

- `BOT_API_HOST`
- `BOT_API_PORT`

## HTTP API

- `GET /bots`
- `GET /bots/:id`
- `GET /bots/:id/snapshots`
- `GET /dashboard/summary`
- `GET /alerts`
- `GET /health`
- `GET /metrics`

## Frontend

React + Vite приложение лежит в `web/`.

Установка зависимостей:

```bash
cd web
npm install
```

Запуск dev-сервера:

```bash
cd web
npm run dev
```

По умолчанию frontend использует `/api` и проксирует запросы в `http://127.0.0.1:3100`.

Если нужно временно вернуться на старый API, можно переопределить:

```bash
cd web
VITE_API_PROXY_TARGET=http://127.0.0.1:3000 npm run dev
```

## launchd автозапуск backend

Для автозапуска Nest backend с polling подготовлены файлы:

- plist: `ops/launchd/local.bybit-bots.backend.plist`
- fallback wrapper: `scripts/start_backend_launchd.sh`

Логи пишутся в `db/tmp/`:

- `db/tmp/launchd-backend.stdout.log`
- `db/tmp/launchd-backend.stderr.log`

Полезные команды:

```bash
chmod +x scripts/start_backend_launchd.sh
cp ops/launchd/local.bybit-bots.backend.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.bybit-bots.backend.plist
launchctl kickstart -k gui/$(id -u)/local.bybit-bots.backend
launchctl print gui/$(id -u)/local.bybit-bots.backend
```

Остановить и убрать агент:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.bybit-bots.backend.plist
rm ~/Library/LaunchAgents/local.bybit-bots.backend.plist
```

## Как это работает

1. Скрипт берет известные `bot_id` из локальной SQLite базы.
2. По всем `futures grid` ботам идет в официальный `POST /v5/fgridbot/detail`.
3. Активным ботам обновляет только inventory.
4. Для завершенных ботов дописывает снапшот в историю только при изменении полей.

## Откуда берутся новые bot_id

Сейчас порядок такой:

1. Если заданы browser env для `list-all-bots`, скрипт пробует Bybit browser endpoint.
2. Если browser endpoint недоступен, можно использовать fallback через Chrome History.

На текущий момент у Bybit есть косяк для CLI-сценария:

- `https://www.bybit.com/x-api/s1/bot/tradingbot/v1/list-all-bots` часто отдает `403`
- поэтому стабильный публичный список ботов через API/CLI пока не гарантирован
- зато `fgridbot/detail` для известного `bot_id` работает нормально

Если позже Bybit откроет нормальный список ботов в API, этот refresh можно будет перевести на полностью request-based схему без history fallback.

## Полезные SQL запросы

Активные боты:

```sql
select bot_id, symbol, status
from bot_inventory
where status like '%RUNNING%'
order by bot_id;
```

Последние снапшоты завершенных `futures grid`:

```sql
select bot_id, symbol, total_pnl, apr, arbitrage_count, snapshot_at
from completed_fgrid_stats_history
order by snapshot_id desc;
```

## Требования

- `BYBIT_API_KEY`
- `BYBIT_API_SECRET`
- `BYBIT_ENV=mainnet` или `testnet`

Скрипт умеет подхватывать эти значения из `~/.zshrc`, если они не проброшены в текущее окружение.
