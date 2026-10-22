.DEFAULT_GOAL := help

PNPM ?= pnpm
DEPLOY_HOST ?= blue
DEPLOY_DIR ?= /var/www/chess.carola.work/current

.PHONY: help install gui web build-gui build-web preview-web deploy deploy-web test lint

help:
	@printf '%s\n' \
	  'make install      Install dependencies from the lockfile' \
	  'make gui          Run the desktop GUI locally (Tauri)' \
	  'make web          Run the web edition locally (Vite, port 1420)' \
	  'make build-gui    Build the desktop application' \
	  'make build-web    Build the web edition into dist-web/' \
	  'make preview-web  Build and preview the web edition on port 4173' \
	  'make deploy       Build and deploy the web edition to chess.carola.work' \
	  'make test         Run unit tests' \
	  'make lint         Check TypeScript and lint' \
	  '' \
	  'Deployment overrides: DEPLOY_HOST=blue DEPLOY_DIR=/var/www/chess.carola.work/current'

install:
	$(PNPM) install --frozen-lockfile

gui:
	$(PNPM) dev

web:
	$(PNPM) dev:web

build-gui:
	$(PNPM) build

build-web:
	$(PNPM) build:web

preview-web: build-web
	$(PNPM) preview:web

deploy: deploy-web

deploy-web: build-web
	rsync -az dist-web/ "$(DEPLOY_HOST):$(DEPLOY_DIR)/"
	ssh "$(DEPLOY_HOST)" "chmod -R a+rX '$(DEPLOY_DIR)' && restorecon -RF '$(DEPLOY_DIR)'"

test:
	$(PNPM) test

lint:
	$(PNPM) lint
