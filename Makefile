.PHONY: up down logs restart ps collector-local collector-prod collector-switch

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

# === Collector ===
collector-local:
	cp fraud-collector/.env.local fraud-collector/.env
	@echo "Switched to LOCAL (localhost:3000)"

collector-prod:
	cp fraud-collector/.env.prod fraud-collector/.env
	@echo "Switched to PROD (api.เช็กคนโกง.com)"

# === DB Sync ===
db-pull:
	ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 "cd /opt/frauds && docker compose exec -T postgres pg_dump -U postgres -d fraud_checker --data-only --no-owner --no-acl --disable-triggers" > db-prod-sync.sql
	docker compose exec -T postgres psql -U postgres -d fraud_checker -c "TRUNCATE TABLE face_embeddings, fraud_reports, fraud_sources, service_payments, search_logs, debtors, payments, subscriptions, lender_profiles, frauds, users, membership_plans, services, system_settings, social_posts, social_persons, searchable_entities CASCADE;"
	docker compose exec -T postgres psql -U postgres -d fraud_checker < db-prod-sync.sql
	@echo "Prod DB synced to local"

db-push:
	docker compose exec -T postgres pg_dump -U postgres -d fraud_checker --data-only --no-owner --no-acl --disable-triggers > db-local-dump.sql
	scp -i ~/.ssh/id_ed25519_hetzner db-local-dump.sql root@5.223.85.66:/opt/frauds/
	ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 "cd /opt/frauds && docker compose exec -T postgres psql -U postgres -d fraud_checker -c 'TRUNCATE TABLE face_embeddings, fraud_reports, fraud_sources, service_payments, search_logs, debtors, payments, subscriptions, lender_profiles, frauds, users, membership_plans, services, system_settings, social_posts, social_persons, searchable_entities CASCADE;' && docker compose exec -T postgres psql -U postgres -d fraud_checker < db-local-dump.sql"
	@echo "Local DB pushed to prod"

# === Deploy ===
deploy:
	git push
	ssh -i ~/.ssh/id_ed25519_hetzner root@5.223.85.66 "cd /opt/frauds && git pull && docker compose up -d --build"
	@echo "Deployed to prod"
