.PHONY: up down logs restart ps

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f api

logs-db:
	docker compose logs -f postgres

restart:
	docker compose down && docker compose up --build -d

ps:
	docker compose ps
