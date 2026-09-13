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

dev:
	docker compose -f docker-compose.hub.yml up --build

# Backend + BFF + MySQL only (no frontend) — for API work and deploys of the API layer.
dev-api:
	docker compose -f docker-compose.hub.yml up --build -d hub-db hub-backend eventando-backend hub-bff

# Frontend container only, pointed at the production BFF (log in with your real account).
# Everything else (Strapi/BFF/MySQL) stays untouched; use `make dev-front-local` to go back.
# After adding npm dependencies, rebuild the image first: `make dev-front-build`.
dev-front-build:
	docker compose -f docker-compose.hub.yml build hub-frontend

dev-front-prod:
	FRONTEND_BFF_URL=https://bff.hubcommunity.io/graphql docker compose -f docker-compose.hub.yml up -d -V --no-deps --force-recreate hub-frontend

dev-front-local:
	docker compose -f docker-compose.hub.yml up -d -V --no-deps --force-recreate hub-frontend

dev-logs:
	docker compose -f docker-compose.hub.yml logs -f hub-backend eventando-backend hub-bff

dev-down:
	docker compose -f docker-compose.hub.yml down
