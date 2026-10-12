start:
	pnpm install
	pnpm run build
	pm2 start pnpm --name hub-community-front -- run start

update:
	git pull
	rm -rf .next
	pnpm install
	pnpm run build
	pm2 restart hub-community-front

# ---------------------------------------------------------------------------------------------
# Desenvolvimento em Docker (REA-21): só precisa do Docker na máquina. start e update, acima,
# são do deploy de produção (pm2 no servidor) e não usam nada daqui.
#   make dev           frontend em http://localhost:4010 com recarga de código, usando o BFF do
#                      .env.dev (padrão: BFF local na 4001); make dev BFF=prod usa o de produção
#   make test          testes como no CI      make build   build como no CI
#   make lint          lint como no CI (lá não bloqueia)
#   make shell         terminal dentro do container
#   make down          para tudo              make reset   para e apaga os volumes (node_modules, .next)
#   make hub           stack inteira: MySQL, Strapi do Hub, Eventando, BFF e frontend (precisa dos
#                      quatro repositórios lado a lado)
# ---------------------------------------------------------------------------------------------
ifeq ($(BFF),prod)
DEV_BFF = BFF_URL=https://bff.hubcommunity.io/graphql BFF_SERVER_URL=https://bff.hubcommunity.io/graphql
endif
DEV_VARS = FRONTEND_NODE_VERSION=$$(cat .nvmrc) \
	FRONTEND_GIT_DIR=$$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo $$PWD/.git) \
	DEV_UID=$$(id -u) DEV_GID=$$(id -g) $(DEV_BFF)
DEV_COMPOSE = $(DEV_VARS) docker compose -f docker-compose.dev.yml --env-file .env.dev
DEV_RUN = $(DEV_COMPOSE) run --rm --build --no-deps frontend sh -c
DEV_INSTALL = pnpm install --frozen-lockfile --reporter=silent

# Stack inteira: cada repositório irmão com o próprio .nvmrc e .env.dev.
HUB_REPOS = ../hub-community-backend ../eventando-manager ../hub-community-bff
HUB_COMPOSE = $(DEV_VARS) \
	BACKEND_NODE_VERSION=$$(cat ../hub-community-backend/.nvmrc) \
	BACKEND_GIT_DIR=$$(git -C ../hub-community-backend rev-parse --path-format=absolute --git-common-dir) \
	EVENTANDO_NODE_VERSION=$$(cat ../eventando-manager/.nvmrc) \
	EVENTANDO_GIT_DIR=$$(git -C ../eventando-manager rev-parse --path-format=absolute --git-common-dir) \
	BFF_NODE_VERSION=$$(cat ../hub-community-bff/.nvmrc) \
	BFF_GIT_DIR=$$(git -C ../hub-community-bff rev-parse --path-format=absolute --git-common-dir) \
	docker compose -f docker-compose.hub.yml --env-file .env.dev

.PHONY: dev down reset logs shell test build lint dev-setup hub hub-setup \
	dev-api dev-front-build dev-front-prod dev-front-local dev-logs dev-down

dev-setup:
	@test -f .env.dev || { cp .env.dev.example .env.dev && echo "Criei o .env.dev a partir do .env.dev.example."; }
	@touch .env
	@mkdir -p node_modules .next

dev: dev-setup
	$(DEV_COMPOSE) up --build

down: dev-setup
	$(DEV_COMPOSE) down

reset: dev-setup
	$(DEV_COMPOSE) down -v

logs: dev-setup
	$(DEV_COMPOSE) logs -f

shell: dev-setup
	$(DEV_COMPOSE) run --rm --build --no-deps frontend bash

test: dev-setup
	$(DEV_RUN) '$(DEV_INSTALL) && pnpm test && bash .github/scripts/env-scripts.test.sh'

build: dev-setup
	$(DEV_RUN) '$(DEV_INSTALL) && pnpm build'

lint: dev-setup
	$(DEV_RUN) '$(DEV_INSTALL) && pnpm exec eslint .'

hub-setup: dev-setup
	@for r in $(HUB_REPOS); do \
		test -f $$r/.nvmrc || { echo "$$r não tem o ambiente Docker (atualize esse repositório)."; exit 1; }; \
		$(MAKE) --no-print-directory -C $$r dev-setup || exit 1; \
	done

hub: hub-setup
	$(HUB_COMPOSE) up --build

# Atalhos antigos, agora em cima dos composes novos.
# Backend + Eventando + BFF (com os bancos), sem o frontend, em segundo plano.
dev-api: hub-setup
	$(HUB_COMPOSE) up --build -d backend eventando bff

dev-front-build: dev-setup
	$(DEV_COMPOSE) build frontend

# Só o frontend, em segundo plano, contra o BFF de produção (entre com a sua conta de verdade).
dev-front-prod: dev-setup
	$(MAKE) --no-print-directory dev-front-local BFF=prod

dev-front-local: dev-setup
	$(DEV_COMPOSE) up -d --build --force-recreate frontend

dev-logs: hub-setup
	$(HUB_COMPOSE) logs -f backend eventando bff

dev-down: hub-setup
	$(HUB_COMPOSE) down
