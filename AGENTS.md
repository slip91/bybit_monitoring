# AGENTS.md

Инструкции для следующей работы по проекту `bybit-bots`.

## Общая структура

- основной backend: `backend/`
- frontend: `web/`
- база SQLite: `db/bybit-bots.sqlite`
- SQL/schema: `db/sql/`
- legacy runtime и bridge-логика: `legacy/`
- тонкие запускные скрипты: `scripts/`
- launchd-файлы: `ops/launchd/`

## Что сейчас считается основным

- основной API: `NestJS` backend на `127.0.0.1:3100`
- polling встроен в backend и запускается вместе с ним
- frontend по умолчанию ходит в backend `3100` через `/api`
- legacy API и legacy polling больше не основной путь, но они еще лежат в проекте

## Автозапуск

Backend настроен через `launchd`.

- установленный агент: `~/Library/LaunchAgents/local.bybit-bots.backend.plist`
- исходный plist в репо: `ops/launchd/local.bybit-bots.backend.plist`
- stdout log: `db/tmp/launchd-backend.stdout.log`
- stderr log: `db/tmp/launchd-backend.stderr.log`

Полезные команды:

```bash
launchctl print gui/$(id -u)/local.bybit-bots.backend
launchctl kickstart -k gui/$(id -u)/local.bybit-bots.backend
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.bybit-bots.backend.plist
```

## Запуск вручную

Backend:

```bash
cd /Users/ovz/Documents/project/bybit-bots/backend
npm run start
```

Frontend:

```bash
cd /Users/ovz/Documents/project/bybit-bots/web
npm run dev
```

## Проверка состояния

UI:

- dashboard: `http://127.0.0.1:5173/`
- service: `http://127.0.0.1:5173/service`
- plan: `http://127.0.0.1:5173/plan`

Смотреть руками в первую очередь:

- страницу `/service`
- `launchctl print ...`
- логи в `db/tmp/launchd-backend.*.log`
- `lsof -nP -iTCP:3100 -sTCP:LISTEN`

Если `curl` к localhost ведет себя странно, не делать из этого дальних выводов: в этой среде это уже случалось.

## Важные доменные нюансы

- плечо бота (`x2`, `x3`) берется из raw `Bybit fgridbot/detail`
- страница плана имеет две разные базы расчета:
  - `Текущий день` = текущая оценка
  - `1 день / 7 дней / 30 дней / 90 дней` = расчет по накопленной истории
- `1 день` разрешен даже при неполном покрытии
- `7/30/90` должны иметь почти полный период наблюдения, иначе они считаются недоступными

## Осторожность

- ничего не торговать и не вызывать торговые endpoint'ы без явного запроса пользователя
- не ломать совместимость текущего UI с backend `3100`
- не удалять legacy слой, пока bridge-логика еще используется в `backend/`

## Полезный соседний файл

- `NEXT_SESSION.md` — короткая оперативная памятка по текущему состоянию и ближайшим шагам
