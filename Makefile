.PHONY: run build build-prod build-bootstrap-prod web-build tidy sqlc migrate-up migrate-down load-sqlite reload-sqlite db-reset dev-rebuild test fmt vet dist clean theme-guard

BIN := ./bin/aether-web
BOOTSTRAP_BIN := ./bin/aether-bootstrap
PKG := ./cmd/server
BOOTSTRAP_PKG := ./cmd/bootstrap

# ---------- Variables para los targets de dev ----------
# Container Docker con PostgreSQL local.
PG_CONTAINER  ?= aether-pg
# Superusuario / db administrativa del contenedor (los que pasaste a `docker run -e ...`).
PG_SUPERUSER  ?= aether_admin
PG_ADMIN_DB   ?= postgres
# BD destino que vamos a tirar y recrear.
PG_TARGET_DB  ?= aether
# Última versión de migración que NO depende de personas (las posteriores se aplican tras load-sqlite).
SCHEMA_CUTOFF ?= 3
# Usuario jon para dev (debe existir en SQLite tras load-sqlite).
DEV_USER      ?= jon
DEV_PASSWORD  ?= 1234
# Nivel de permiso que se fija al usuario de dev (Común|Operacional|Administrativo|Seguridad|Superusuario).
DEV_LEVEL     ?= Superusuario

# ---------- Desarrollo local ----------

run:
	go run $(PKG)

build:
	mkdir -p bin
	go build -o $(BIN) $(PKG)

tidy:
	go mod tidy

sqlc:
	sqlc generate

migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path migrations -database "$(DATABASE_URL)" down 1

# Carga datos productivos desde database-utils/Aether.db al PostgreSQL apuntado por $DATABASE_URL.
# Requiere haber aplicado migraciones 0001-0003 (NO 0004 todavía).
load-sqlite:
	./.venv/bin/python database-utils/migrationSQLiteToPostgres.py --pg-dsn "$(DATABASE_URL)"

# Re-importa desde cero usando un Aether.db actualizado:
#   1) TRUNCATE (CASCADE) las tablas que carga el script Python
#   2) recarga desde SQLite
# El seed productivo (0004) es solo-up y queda como cima de migración, así que
# aquí no hay migrate down/up. Para un reset total del esquema usa `make dev-rebuild`.
reload-sqlite:
	./.venv/bin/python database-utils/migrationSQLiteToPostgres.py --pg-dsn "$(DATABASE_URL)" --truncate

# DROP + CREATE de la BD destino. Mantiene el contenedor PostgreSQL en marcha.
# Útil para empezar de cero sin esperar 5-10s a que el contenedor arranque.
db-reset:
	@docker ps --filter name=$(PG_CONTAINER) --filter status=running --format '{{.Names}}' | grep -q $(PG_CONTAINER) \
	  || { echo "ERROR: container '$(PG_CONTAINER)' no corre. Arráncalo con: docker start $(PG_CONTAINER)"; exit 1; }
	@echo "==> DROP + CREATE DATABASE $(PG_TARGET_DB)…"
	docker exec $(PG_CONTAINER) psql -U $(PG_SUPERUSER) -d $(PG_ADMIN_DB) -c "DROP DATABASE IF EXISTS $(PG_TARGET_DB) WITH (FORCE);"
	docker exec $(PG_CONTAINER) psql -U $(PG_SUPERUSER) -d $(PG_ADMIN_DB) -c "CREATE DATABASE $(PG_TARGET_DB);"

# Rebuild completo de desarrollo:
#   1) db-reset             (drop + create de la BD)
#   2) migraciones 1..N     (esquema + lookups + auth + triggers)
#   3) load-sqlite          (carga personas, vuelos, etc. desde Aether.db)
#   4) migraciones N+1..    (datos productivos que referencian personas)
#   5) bootstrap admin      (DEV_USER / DEV_PASSWORD, nivel DEV_LEVEL)
#
# Sobrescribibles:
#   make dev-rebuild DEV_USER=otro DEV_PASSWORD=otra DEV_LEVEL=Operacional SCHEMA_CUTOFF=5
dev-rebuild: db-reset
	@echo "==> Aplicando migraciones 1..$(SCHEMA_CUTOFF) (esquema)…"
	migrate -path migrations -database "$(DATABASE_URL)" goto $(SCHEMA_CUTOFF)
	@echo "==> Cargando datos productivos desde SQLite…"
	./.venv/bin/python database-utils/migrationSQLiteToPostgres.py --pg-dsn "$(DATABASE_URL)"
	@echo "==> Aplicando migraciones $(SCHEMA_CUTOFF)+ (datos dependientes de personas)…"
	migrate -path migrations -database "$(DATABASE_URL)" up
	@echo "==> Configurando contraseña y nivel '$(DEV_LEVEL)' de '$(DEV_USER)'…"
	@AETHER_DATABASE_URL="$(DATABASE_URL)" go run $(BOOTSTRAP_PKG) -user $(DEV_USER) -password $(DEV_PASSWORD) -level $(DEV_LEVEL)
	@echo
	@echo "==> Listo. Usuario '$(DEV_USER)' / contraseña '$(DEV_PASSWORD)' / nivel '$(DEV_LEVEL)'."

test:
	go test ./...

fmt:
	gofmt -w .

vet:
	go vet ./...

# Linter completo (mismo que CI). Instalar con:
#   go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
lint:
	golangci-lint run

# Regenera los tipos TypeScript desde los DTOs Go (tygo.yaml).
# Instalar con: go install github.com/gzuidhof/tygo@latest
types:
	tygo generate

# Falla si hay colores hardcodeados en el frontend fuera de web/src/app/theme.css
# (mismo check que el job theme-guard del CI; excepciones en el propio script).
theme-guard:
	./scripts/theme-guard.sh

# ---------- Producción (Linux/amd64) ----------

# 1) build del frontend → web/dist (embebido en el binario via web/embed.go)
web-build:
	cd web && npm ci && npm run build

# 2) binario del server con frontend embebido, sin símbolos de debug, ruta absoluta limpia
build-prod: web-build
	mkdir -p bin
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	  go build -trimpath -ldflags='-s -w' -o $(BIN) $(PKG)

# 3) CLI de bootstrap (alta de primer usuario admin)
build-bootstrap-prod:
	mkdir -p bin
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	  go build -trimpath -ldflags='-s -w' -o $(BOOTSTRAP_BIN) $(BOOTSTRAP_PKG)

# 4) tarball auto-contenido: binario + bootstrap + migrations + deploy/
#    (lo que copias al servidor)
DIST_DIR := dist
TARBALL := aether-web-linux-amd64.tar.gz
dist: build-prod build-bootstrap-prod
	rm -rf $(DIST_DIR)
	mkdir -p $(DIST_DIR)/aether-web
	cp $(BIN) $(BOOTSTRAP_BIN) $(DIST_DIR)/aether-web/
	cp -r migrations $(DIST_DIR)/aether-web/
	cp -r deploy $(DIST_DIR)/aether-web/
	cd $(DIST_DIR) && tar -czf $(TARBALL) aether-web/
	@echo "==> $(DIST_DIR)/$(TARBALL)"

clean:
	rm -rf bin/ $(DIST_DIR)/ web/dist/
