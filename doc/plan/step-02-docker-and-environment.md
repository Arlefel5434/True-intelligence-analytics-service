# Шаг 2. Docker и конфигурация окружения

**Статус:** завершён.

**Результат:** один `docker-compose.yml` с профилями `demo` и `dev`, production Dockerfile-стадиями, Nginx и постоянным PostgreSQL volume.

## Цель

Обеспечить запуск всей системы одной командой и разделить секреты, внутренние адреса и публичные настройки.

## Что сделать

1. Создать Dockerfile для `api`, `provider-mock` и `web` с отдельными development/production стадиями. Production-стадия `web` собирает React в Node и переносит статические файлы в Nginx.
2. Создать один `docker-compose.yml` с профилями `demo` и `dev` и сервисами:
   - `postgres`;
   - `api`;
   - `provider-mock`;
   - `web`.
3. В production/demo использовать `web` на основе Nginx как единственную публичную точку входа: `/` раздаёт React с fallback на `index.html`, `/api/*` проксируется в `api`.
4. В development использовать Node/Vite target с hot reload и Vite proxy для `/api`; отдельный Nginx в development не запускать.
5. Настроить внутреннюю Docker-сеть: основной API обращается к mock-провайдеру по имени сервиса, а PostgreSQL не использует публичный адрес приложения.
6. Добавить health checks и зависимости запуска без предположения, что порядок старта гарантирует готовность сервиса.
7. Подготовить `.env.example` с переменными:
   - параметры PostgreSQL;
   - URL frontend и backend;
   - JWT access/refresh secrets;
   - срок жизни токенов;
   - API-ключ mock-провайдера;
   - URL mock-провайдера;
   - разрешённые origins;
   - режим cookie `Secure`.
8. Валидировать переменные окружения при старте приложений и завершать запуск с понятной ошибкой при отсутствии обязательной настройки.
9. Не помещать рабочие секреты и реальные доступы в репозиторий.
10. Публиковать в обоих профилях только host-порт `8080`; API, mock-провайдер и PostgreSQL оставить во внутренней сети.
11. Зафиксировать Node `24.22.2`, pnpm `12.19.0`, PostgreSQL `18.6` по digest и стабильный Nginx `1.30.6`.

## Критерии готовности

- `docker compose -f docker-compose.yml --profile demo up --build` поднимает production/demo окружение.
- `docker compose -f docker-compose.yml --profile dev up --build` поднимает development окружение с watch-режимом.
- Production/demo открывается через Nginx по одному origin; API, mock-провайдер и PostgreSQL не публикуются для браузера.
- Development frontend работает через Vite с hot reload без Nginx.
- API ждёт готовности PostgreSQL, а не только запуска контейнера.
- Основной API может обратиться к health endpoint mock-провайдера.
- В репозитории находится только безопасный `.env.example`.

## Зависимости

- Шаг 1.

## Проверка результата

- [x] Оба profile проходят `docker compose config`.
- [x] Production/demo images собираются reproducibly из зафиксированных базовых образов.
- [x] Demo: PostgreSQL, mock-провайдер, API и Nginx становятся healthy в правильном порядке.
- [x] Demo: React отвечает через Nginx, `/api/health/live` доступен через Nginx proxy.
- [x] Dev: зависимости устанавливаются в named volumes, Vite и NestJS запускаются в watch-режиме.
- [x] Dev: React и `/api/health/live` доступны через Vite proxy на `localhost:8080`.
- [x] Backend и Nginx production processes работают не от root.
- [x] PostgreSQL data сохраняется в named volume с корректной для PostgreSQL 18 точкой монтирования.
- [x] Только порт `8080` опубликован на host.
- [x] Реально используемый `PORT` валидируется при старте приложений.
