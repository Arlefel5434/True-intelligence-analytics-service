# Шаг 1. Структура монорепозитория

**Статус:** завершён.

**Результат:** Docker-first `pnpm workspace` с тремя приложениями, compile-safe пакетом API-клиента и общими проверками.

## Цель

Подготовить воспроизводимую структуру проекта и общие команды разработки.

## Что сделать

1. Инициализировать `pnpm workspace` со структурой:

   ```text
   apps/
     api/
     provider-mock/
     web/
   packages/
     api-client/
   doc/plan/
   ```

2. Создать:
   - NestJS-приложение `apps/api`;
   - NestJS-приложение `apps/provider-mock`;
   - React + Vite + TypeScript приложение `apps/web`;
   - пакет с генерируемым OpenAPI-клиентом `packages/api-client`.
3. Настроить общие команды корневого `package.json`:
   - `dev`;
   - `build`;
   - `lint`;
   - `test`;
   - `test:e2e`;
   - `format`;
   - `api:generate`.
4. Настроить TypeScript, ESLint и Prettier без дублирования несовместимых конфигураций.
5. Добавить `.gitignore`, включая `.idea`, `.env`, `node_modules`, build-артефакты, coverage и сгенерированные временные файлы.
6. Добавить минимальные health endpoints для обоих backend-приложений.
7. Зафиксировать Node `24.22.2`, pnpm `12.19.0`, TypeScript `5.9.3` и совместимую линию NestJS 11.
8. Добавить `Makefile`, запускающий install/build/lint/typecheck/test внутри одноразового Node-контейнера от UID/GID текущего пользователя.

## Критерии готовности

- Установка выполняется одной командой `make install` без локальных Node/pnpm; внутри контейнера вызывается `pnpm install --frozen-lockfile`.
- Все приложения собираются из корня.
- `.idea` и секреты не попадают в Git.
- Health endpoints отвечают без подключения бизнес-модулей.

## Зависимости

- Шаг 0.

## Проверка результата

- [x] `pnpm-lock.yaml` создан и peer dependencies согласованы.
- [x] Общие TypeScript, ESLint и Prettier настройки применяются ко всем пакетам.
- [x] `api`, `provider-mock`, `web` и `api-client` проходят typecheck и build.
- [x] Unit-тесты API и mock-провайдера, а также frontend-тест проходят.
- [x] E2E-команда существует и корректно завершается до появления тестов следующих шагов.
- [x] `/api/health/live` и `/health/live` проверены на реально запущенных production-сборках.
- [x] `.idea/` остаётся локальной, но исключена из Git.
