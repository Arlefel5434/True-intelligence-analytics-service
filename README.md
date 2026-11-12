# Аналитика данных филлиалов компаний

MVP Сервис для просмотра ежедневных показателей филиалов. Клиент видит только свою компанию, администратор выбирает компанию и запускает импорт из имитируемого внешнего API. Данные демонстрационные.

## Архитектура и стек


React, TypeScript, Tailwind и Recharts отвечают за кабинет и график. NestJS реализует аутентификацию, разграничение компаний, импорт и аналитику. Prisma и PostgreSQL хранят пользователей, филиалы, ежедневные показатели и историю импортов. Отдельный mock provider позволяет воспроизводить импорт без доступа к реальному геосервису. В demo-профиле nginx раздаёт собранный frontend и проксирует `/api`; в dev-профиле эту роль выполняет Vite.

## Первый запуск

Нужны Docker Engine с Compose и свободный порт приложения. Node и pnpm на хосте не требуются. Скопируйте `.env.example` в `.env`. При занятом `8080` задайте согласованные значения, например `APP_PORT=8081` и `APP_ORIGIN=http://localhost:8081`.

```bash
docker compose --profile dev up -d --build
docker compose --profile dev exec api-dev pnpm --filter @tia/api run db:migrate:deploy
docker compose --profile dev exec api-dev pnpm --filter @tia/api run db:seed
```

Откройте `http://localhost:8080` (или порт из `.env`). \
API health: `/api/health/live` и `/api/health/ready`; \
Swagger: `/api/docs`.
Первый запуск новой базы требует миграции и seed: статус healthy означает соединение с PostgreSQL, но не наличие таблиц. Seed иммподентный.

Для проверки собранного приложения используйте `docker compose --profile demo up -d --build`. На чистой базе примените миграции и seed через tools-контейнер:

```bash
docker compose --profile demo --profile tools run --rm db-tools pnpm --filter @tia/api run db:migrate:deploy
docker compose --profile demo --profile tools run --rm db-tools pnpm --filter @tia/api run db:seed
```

## Демонстрационные учётные записи

| Роль                       | Email                   | Пароль             |
| -------------------------- | ----------------------- | ------------------ |
| Администратор              | `admin@example.test`    | `123qwe123qwe` |
| Клиент «Terro Brill»       | `client.a@example.test` | `123qwe123qwe` |
| Клиент «02Кафе»            | `client.b@example.test` | `123qwe123qwe` |

Эти данные предназначены только для локальной демонстрации. Секреты из `.env.example` также не подходят для развёртывания вне локальной машины.

## Тесты

Тесты API используют отдельную базу `tia_test`, которую создаёт скрипт подготовки. Вне Compose задайте `ADMIN_DATABASE_URL` и `TEST_DATABASE_URL` для тестового PostgreSQL. Скрипт откажется готовить базу с именем, отличным от `tia_test`. В Compose эти переменные настроены у сервиса `db-tools`.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm verify
```

В Docker dev-контейнере команды `lint`, `typecheck` и `test` запускаются через `docker compose --profile dev run --rm --no-deps workspace-init pnpm <команда>`. E2e запускаются отдельно: `docker compose --profile dev --profile tools run --rm --build db-tools pnpm --filter @tia/api run test:e2e`. Для общей команды `pnpm verify` нужен полный workspace и перечисленные выше переменные окружения. E2e выполняет миграции и seed именно в `tia_test`.

## Ограничения текущей версии

- Импорт запускается администратором вручную и выполняется в рамках HTTP-запроса. Фоновых задач и расписания нет.
- Данные поступают только из одного имитируемого внешнего источника; подключения к реальным геосервисам нет.
- Пользователи создаются демонстрационным seed-скриптом. Интерфейса для управления пользователями и компаниями нет.
- Отзывы представлены в базе и ежедневных показателях, но отдельного пользовательского раздела для работы с ними нет.
- Аналитика хранится по календарным дням без учёта часового пояса каждого филиала.
- Секреты для локальной демонстрации заданы через переменные окружения; централизованного управления production-секретами нет.
- Система не предусматривает возможность смены пароля
