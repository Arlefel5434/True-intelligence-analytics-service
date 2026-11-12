NODE_IMAGE := node:24.22.2-bookworm-slim
PNPM_VERSION := 12.19.0
CONTAINER_RUN := docker run --rm --user $(shell id -u):$(shell id -g) -e npm_config_cache=/workspace/.cache/npm -v $(CURDIR):/workspace -w /workspace $(NODE_IMAGE)
PNPM := $(CONTAINER_RUN) npx --yes pnpm@$(PNPM_VERSION)

.PHONY: install format format-check peers lint typecheck build test test-e2e api-generate check

install:
	$(PNPM) install --frozen-lockfile

format:
	$(PNPM) format

format-check:
	$(PNPM) format:check

peers:
	$(PNPM) peers check

lint:
	$(PNPM) lint

typecheck:
	$(PNPM) typecheck

build:
	$(PNPM) build

test:
	$(PNPM) test

test-e2e:
	$(PNPM) test:e2e

api-generate:
	$(PNPM) api:generate

check: peers lint typecheck build test test-e2e format-check
